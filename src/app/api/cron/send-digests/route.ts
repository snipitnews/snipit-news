import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchNewsForMultipleTopics } from '@/lib/newsapi';
import { summarizeNews, NewsArticle } from '@/lib/openai';
import { sendNewsDigest } from '@/lib/email';

// Types
interface UserTopic {
  topic_name: string;
}

interface EmailSetting {
  paused: boolean;
  delivery_time: string;
  timezone: string;
}

interface UserWithRelations {
  id: string;
  email: string;
  subscription_tier: 'free' | 'paid';
  user_topics: UserTopic[] | null;
  user_email_settings: EmailSetting[] | null;
}

interface ProcessResult {
  processed: boolean;
  successful: boolean;
  skipped: boolean;
  error: string | null;
  skipReason: string | null;
}

interface BatchResults {
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: string[];
  skipReasons: string[];
}

// Maximum execution time before returning (50 seconds to leave buffer for Vercel's 60s limit)
const MAX_EXECUTION_TIME_MS = 50000;
// Maximum users to process in one batch before returning (increased from 5 to 10)
const MAX_BATCH_SIZE = 10;

// Process a single user using pre-fetched news data (extracted for batch processing)
async function processUser(
  user: UserWithRelations,
  newsData: Record<string, NewsArticle[]>
): Promise<ProcessResult> {
  const result: ProcessResult = {
    processed: true,
    successful: false,
    skipped: false,
    error: null,
    skipReason: null,
  };

  try {
    // Check if user has paused emails
    const emailSettings = user.user_email_settings?.[0];
    if (emailSettings?.paused) {
      result.skipped = true;
      result.skipReason = `User ${user.email} has paused emails`;
      return result;
    }

    if (!user.user_topics || user.user_topics.length === 0) {
      result.skipped = true;
      result.skipReason = `User ${user.email} has no topics`;
      return result;
    }

    // Process user - send email at 8:30 AM EST regardless of user's timezone
    const topics = user.user_topics.map((ut) => ut.topic_name);
    console.log(
      `Processing user ${user.email} with topics: ${topics.join(', ')}`
    );

    // Generate summaries for each topic using pre-fetched news data
    const summaries = [];
    for (const topic of topics) {
      const articles = newsData[topic] || [];
      if (articles.length > 0) {
        const summary = await summarizeNews(
          topic,
          articles,
          user.subscription_tier === 'paid'
        );
        if (summary.summaries.length > 0) {
          summaries.push(summary);
        }
      }
    }

    if (summaries.length === 0) {
      result.skipped = true;
      result.skipReason = `No news found for user ${user.email} (topics: ${topics.join(', ')})`;
      console.log(`[Cron] Skipping ${user.email}: No summaries generated for topics: ${topics.join(', ')}`);
      return result;
    }

    // Send email digest
    const emailResult = await sendNewsDigest(
      user.email,
      summaries,
      user.subscription_tier === 'paid'
    );

    if (emailResult.success) {
      // Store in email archive
      try {
        await getSupabaseAdmin()
          .from('email_archive')
          .insert({
            user_id: user.id,
            subject: `Your SnipIt Daily Digest - ${new Date().toLocaleDateString()}`,
            content: summaries as unknown,
            topics: topics,
          } as never);
      } catch (archiveError) {
        console.error(
          `[Cron] Failed to archive email for ${user.email}:`,
          archiveError
        );
        // Don't fail the whole operation if archiving fails
      }

      result.successful = true;
      console.log(`[Cron] ✅ Successfully sent digest to ${user.email} (${summaries.length} topics)`);
    } else {
      const errorMsg = emailResult.error || 'Unknown email error';
      result.error = `Failed to send email to ${user.email}: ${errorMsg}`;
      console.error(`[Cron] ❌ ${result.error}`, emailResult.details ? `Details: ${JSON.stringify(emailResult.details)}` : '');
    }
  } catch (error) {
    result.error = `Error processing user ${user.email}: ${error}`;
    console.error(result.error);
  }

  return result;
}

export async function GET(request: NextRequest) {
  // Verify this is a legitimate cron request
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = getSupabaseAdmin();

  try {
    console.log('Starting daily digest process...');

    // Get all users with topics and their email settings
    // Also ensure users without email settings get them created
    const { data: users, error: usersError } = (await getSupabaseAdmin()
      .from('users')
      .select(
        `
        id,
        email,
        subscription_tier,
        user_topics (
          topic_name
        ),
        user_email_settings (
          paused,
          delivery_time,
          timezone
        )
      `
      )
      .not('user_topics', 'is', null)) as {
      data: UserWithRelations[] | null;
      error: unknown;
    };

    // Ensure all users have email settings (create if missing)
    if (users && users.length > 0) {
      for (const user of users) {
        if (!user.user_email_settings || user.user_email_settings.length === 0) {
          console.log(`[Cron] Creating missing email settings for user ${user.email}`);
          try {
            await getSupabaseAdmin()
              .from('user_email_settings')
              .upsert(
                {
                  user_id: user.id,
                  delivery_time: '08:30:00-05:00',
                  timezone: 'America/New_York',
                  paused: false,
                } as never,
                {
                  onConflict: 'user_id',
                }
              );
            // Refresh user's email settings
            const { data: settings } = await getSupabaseAdmin()
              .from('user_email_settings')
              .select('paused, delivery_time, timezone')
              .eq('user_id', user.id)
              .single();
            if (settings) {
              user.user_email_settings = [settings as EmailSetting];
            }
          } catch (settingsError) {
            console.error(`[Cron] Failed to create email settings for ${user.email}:`, settingsError);
          }
        }
      }
    }

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    if (!users || users.length === 0) {
      console.log('No users with topics found');
      return NextResponse.json({ message: 'No users to process' });
    }

    console.log(`Found ${users.length} users to process`);

    // Check if there's a continuation token (for batch processing)
    const url = new URL(request.url);
    const continuationToken = url.searchParams.get('continuation');
    const startIndex = continuationToken ? parseInt(continuationToken, 10) : 0;

    // Get batch of users to process
    const batchUsers = users.slice(startIndex, startIndex + MAX_BATCH_SIZE);
    console.log(`Processing batch: ${batchUsers.length} users (starting at index ${startIndex})`);

    // OPTIMIZATION: Collect all unique topics across batch users first
    // This avoids fetching news for the same topic multiple times
    const uniqueTopics = new Set<string>();
    
    for (const user of batchUsers) {
      // Skip users who will be skipped anyway (paused, no topics)
      const emailSettings = user.user_email_settings?.[0];
      if (emailSettings?.paused || !user.user_topics || user.user_topics.length === 0) {
        continue;
      }

      const topics = user.user_topics.map((ut) => ut.topic_name);
      for (const topic of topics) {
        uniqueTopics.add(topic);
      }
    }

    console.log(`Found ${uniqueTopics.size} unique topics across ${batchUsers.length} users`);

    // Fetch news once for all unique topics (major optimization!)
    const newsData: Record<string, NewsArticle[]> = {};
    if (uniqueTopics.size > 0) {
      const topicsArray = Array.from(uniqueTopics);
      console.log(`Fetching news for ${topicsArray.length} unique topics: ${topicsArray.join(', ')}`);
      const fetchedNews = await fetchNewsForMultipleTopics(topicsArray);
      Object.assign(newsData, fetchedNews);
    }

    const results: BatchResults = {
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      skipReasons: [],
    };

    // Process users in batches until we hit time or batch limit
    let processedCount = 0;
    for (let i = 0; i < batchUsers.length; i++) {
      // Check if we've exceeded time limit
      const elapsed = Date.now() - startTime;
      if (elapsed > MAX_EXECUTION_TIME_MS) {
        console.log(
          `Time limit reached. Processed ${processedCount} users, ${batchUsers.length - i} remaining in batch`
        );
        break;
      }

      const user = batchUsers[i];
      const result = await processUser(user, newsData);

      results.processed++;
      processedCount++;

      if (result.skipped) {
        results.skipped++;
        if (result.skipReason) {
          results.skipReasons.push(result.skipReason);
        }
      } else if (result.successful) {
        results.successful++;
      } else if (result.error) {
        results.failed++;
        results.errors.push(result.error);
      }

      // Add delay between users to respect rate limits
      // Reduced delay since we're processing more users per batch
      if (i < batchUsers.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }

    const executionTime = Date.now() - startTime;
    const hasMore = startIndex + batchUsers.length < users.length;
    const status =
      results.failed > 0 && results.successful === 0 ? 'failed' : 'success';

    // Log execution results to database with detailed information
    try {
      // Include skip reasons in errors array for better visibility
      const allErrors = [
        ...results.errors,
        ...results.skipReasons.map(reason => `SKIPPED: ${reason}`)
      ];
      
      await supabase.from('cron_job_logs').insert({
        status,
        processed_count: results.processed,
        successful_count: results.successful,
        failed_count: results.failed,
        skipped_count: results.skipped,
        errors: allErrors.length > 0 ? allErrors : [],
        execution_time_ms: executionTime,
      } as never);
      
      console.log(`[Cron] Logged execution: ${results.successful} successful, ${results.failed} failed, ${results.skipped} skipped`);
    } catch (logError) {
      console.error('[Cron] Failed to log cron job execution:', logError);
      // Don't fail the request if logging fails
    }

    console.log(
      `Batch completed: ${results.processed} processed, ${results.successful} successful, ${results.failed} failed, ${results.skipped} skipped`
    );

    // If there are more users to process, trigger next batch via background fetch
    if (hasMore) {
      const nextIndex = startIndex + batchUsers.length;
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.url.split('/api')[0];
      const nextUrl = `${baseUrl}/api/cron/send-digests?continuation=${nextIndex}`;

      // Trigger next batch in background (don't await)
      console.log(`[Cron] Triggering next batch: ${nextIndex}/${users.length} users remaining`);
      fetch(nextUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      }).catch((err) => {
        console.error(`[Cron] ❌ Failed to trigger next batch (index ${nextIndex}):`, err);
      });

      return NextResponse.json({
        message: 'Batch processing in progress',
        results,
        executionTimeMs: executionTime,
        remaining: users.length - nextIndex,
        nextBatchTriggered: true,
        topicsFetched: uniqueTopics.size,
      });
    }

    return NextResponse.json({
      message: 'Daily digest process completed',
      results,
      executionTimeMs: executionTime,
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log failure to database
    try {
      await supabase.from('cron_job_logs').insert({
        status: 'failed',
        processed_count: 0,
        successful_count: 0,
        failed_count: 0,
        skipped_count: 0,
        errors: [errorMessage],
        execution_time_ms: executionTime,
      } as never);
    } catch (logError) {
      console.error('Failed to log cron job failure:', logError);
    }

    console.error('Error in daily digest process:', error);
    return NextResponse.json(
      {
        error: 'Daily digest process failed',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
