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

// Maximum users to process in one batch before returning
const MAX_BATCH_SIZE = 10;
// Timeout for individual summarization calls (15 seconds)
const SUMMARIZATION_TIMEOUT_MS = 15000;
// Rate limit delay for email sending (Resend allows 2 req/sec, so 500ms between each)
const EMAIL_RATE_LIMIT_DELAY_MS = 550; // Slightly over 500ms for safety margin

// Utility function to wrap promises with a timeout
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs
    )
  );
  return Promise.race([promise, timeoutPromise]);
}

// Utility function to delay execution
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Log digest failure to database
async function logDigestFailure(
  userId: string,
  topics: string[],
  failureReason: string,
  failureType: 'fetch_error' | 'summary_error' | 'email_error' | 'unknown',
  errorDetails?: any
): Promise<void> {
  try {
    await getSupabaseAdmin()
      .from('digest_failures')
      .insert({
        user_id: userId,
        failure_reason: failureReason,
        failure_type: failureType,
        topics: topics,
        error_details: errorDetails ? JSON.stringify(errorDetails) : null,
        retry_count: 0,
        resolved: false,
      } as never);

    console.log(`[Cron] Logged digest failure for user ${userId}: ${failureReason}`);
  } catch (error) {
    console.error(`[Cron] Failed to log digest failure:`, error);
    // Don't fail the whole process if logging fails
  }
}

// Prepared email data for a user (after summarization, before sending)
interface PreparedEmail {
  user: UserWithRelations;
  summaries: Awaited<ReturnType<typeof summarizeNews>>[];
  topics: string[];
  isPaid: boolean;
}

// Result from preparing a user's email (summarization phase)
interface PrepareResult {
  prepared: boolean;
  skipped: boolean;
  skipReason: string | null;
  error: string | null;
  emailData: PreparedEmail | null;
}

// Prepare a single user's email content (generate summaries) without sending
async function prepareUserEmail(
  user: UserWithRelations,
  newsData: Record<string, NewsArticle[]>
): Promise<PrepareResult> {
  const result: PrepareResult = {
    prepared: false,
    skipped: false,
    skipReason: null,
    error: null,
    emailData: null,
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

    const topics = user.user_topics.map((ut) => ut.topic_name);
    console.log(
      `[Cron] Preparing email for ${user.email} with topics: ${topics.join(', ')}`
    );

    // Generate summaries for each topic using pre-fetched news data (PARALLELIZED)
    const isPaid = user.subscription_tier === 'paid';
    const topicsWithArticles = topics.filter(topic => (newsData[topic] || []).length > 0);

    // Process all topics in parallel with timeout protection
    const summaryPromises = topicsWithArticles.map(async (topic) => {
      try {
        const summary = await withTimeout(
          summarizeNews(topic, newsData[topic], isPaid),
          SUMMARIZATION_TIMEOUT_MS,
          `Summarization for "${topic}"`
        );
        return { topic, summary, error: null };
      } catch (error) {
        console.error(`[Cron] Error generating summary for topic "${topic}":`, error);
        return { topic, summary: null, error };
      }
    });

    const summaryResults = await Promise.allSettled(summaryPromises);

    const summaries: Awaited<ReturnType<typeof summarizeNews>>[] = [];
    let hadSummaryErrors = false;

    for (const settledResult of summaryResults) {
      if (settledResult.status === 'fulfilled') {
        const { summary, error } = settledResult.value;
        if (error) {
          hadSummaryErrors = true;
        } else if (summary && summary.summaries.length > 0) {
          summaries.push(summary);
        }
      } else {
        hadSummaryErrors = true;
        console.error(`[Cron] Unexpected summary promise rejection:`, settledResult.reason);
      }
    }

    if (summaries.length === 0) {
      if (hadSummaryErrors) {
        await logDigestFailure(
          user.id,
          topics,
          `Failed to generate summaries for topics: ${topics.join(', ')}`,
          'summary_error',
          { message: 'All summary generation attempts failed' }
        );
      }

      result.skipped = true;
      result.skipReason = `No news found for user ${user.email} (topics: ${topics.join(', ')})`;
      console.log(`[Cron] Skipping ${user.email}: No summaries generated`);
      return result;
    }

    // Return prepared email data (don't send yet)
    result.prepared = true;
    result.emailData = { user, summaries, topics, isPaid };
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.error = `Error preparing email for ${user.email}: ${errorMsg}`;
    console.error(result.error);

    const topics = user.user_topics?.map((ut) => ut.topic_name) || [];
    await logDigestFailure(
      user.id,
      topics,
      errorMsg,
      'unknown',
      { stack: error instanceof Error ? error.stack : undefined }
    );
  }

  return result;
}

// Send a prepared email (called sequentially with rate limiting)
async function sendPreparedEmail(
  emailData: PreparedEmail
): Promise<ProcessResult> {
  const result: ProcessResult = {
    processed: true,
    successful: false,
    skipped: false,
    error: null,
    skipReason: null,
  };

  const { user, summaries, topics, isPaid } = emailData;

  try {
    const emailResult = await sendNewsDigest(user.email, summaries, isPaid);

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
      }

      result.successful = true;
      console.log(`[Cron] ✅ Successfully sent digest to ${user.email} (${summaries.length} topics)`);
    } else {
      const errorMsg = emailResult.error || 'Unknown email error';
      result.error = `Failed to send email to ${user.email}: ${errorMsg}`;
      console.error(`[Cron] ❌ ${result.error}`);

      await logDigestFailure(
        user.id,
        topics,
        errorMsg,
        'email_error',
        emailResult.details
      );
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.error = `Error sending email to ${user.email}: ${errorMsg}`;
    console.error(result.error);

    await logDigestFailure(
      user.id,
      topics,
      errorMsg,
      'email_error',
      { stack: error instanceof Error ? error.stack : undefined }
    );
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
                  delivery_time: '06:30:00-05:00',
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

    // PHASE 1: Prepare all emails in parallel (summarization is parallelized)
    console.log(`[Cron] Phase 1: Preparing ${batchUsers.length} emails in parallel...`);

    const preparePromises = batchUsers.map(user => prepareUserEmail(user, newsData));
    const prepareResults = await Promise.allSettled(preparePromises);

    // Collect prepared emails and handle skipped/failed users
    const preparedEmails: PreparedEmail[] = [];

    for (let i = 0; i < prepareResults.length; i++) {
      const settledResult = prepareResults[i];

      if (settledResult.status === 'fulfilled') {
        const prepResult = settledResult.value;

        if (prepResult.skipped) {
          results.processed++;
          results.skipped++;
          if (prepResult.skipReason) {
            results.skipReasons.push(prepResult.skipReason);
          }
        } else if (prepResult.error) {
          results.processed++;
          results.failed++;
          results.errors.push(prepResult.error);
        } else if (prepResult.prepared && prepResult.emailData) {
          preparedEmails.push(prepResult.emailData);
        }
      } else {
        results.processed++;
        results.failed++;
        const errorMsg = `Email preparation failed: ${settledResult.reason}`;
        results.errors.push(errorMsg);
        console.error(`[Cron] ${errorMsg}`);
      }
    }

    // PHASE 2: Send emails sequentially with rate limiting (Resend allows 2 req/sec)
    console.log(`[Cron] Phase 2: Sending ${preparedEmails.length} emails with rate limiting...`);

    for (let i = 0; i < preparedEmails.length; i++) {
      const emailData = preparedEmails[i];

      // Add delay between emails to respect rate limit (skip delay for first email)
      if (i > 0) {
        await delay(EMAIL_RATE_LIMIT_DELAY_MS);
      }

      const sendResult = await sendPreparedEmail(emailData);
      results.processed++;

      if (sendResult.successful) {
        results.successful++;
      } else if (sendResult.error) {
        results.failed++;
        results.errors.push(sendResult.error);
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
