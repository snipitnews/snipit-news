import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchNewsForMultipleTopics } from '@/lib/newsapi';
import { summarizeNews } from '@/lib/openai';
import { sendNewsDigest } from '@/lib/email';

export async function GET(request: NextRequest) {
  // Verify this is a legitimate cron request
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('Starting daily digest process...');

    // Define types for the query result
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

    // Get all users with topics and their email settings
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

    console.log(`Processing ${users.length} users...`);

    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Process each user
    for (const user of users) {
      try {
        results.processed++;

        // Check if user has paused emails
        const emailSettings = user.user_email_settings?.[0];
        if (emailSettings?.paused) {
          console.log(`User ${user.email} has paused emails, skipping`);
          results.skipped++;
          continue;
        }

        if (!user.user_topics || user.user_topics.length === 0) {
          console.log(`User ${user.email} has no topics, skipping`);
          results.skipped++;
          continue;
        }

        const topics = user.user_topics.map((ut) => ut.topic_name);
        console.log(
          `Processing user ${user.email} with topics: ${topics.join(', ')}`
        );

        // Fetch news for all topics
        const newsData = await fetchNewsForMultipleTopics(topics);

        // Generate summaries for each topic
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
          console.log(`No news found for user ${user.email}`);
          results.skipped++;
          continue;
        }

        // Send email digest
        const emailSent = await sendNewsDigest(
          user.email,
          summaries,
          user.subscription_tier === 'paid'
        );

        if (emailSent) {
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
              `Failed to archive email for ${user.email}:`,
              archiveError
            );
          }

          results.successful++;
          console.log(`Successfully sent digest to ${user.email}`);
        } else {
          results.failed++;
          results.errors.push(`Failed to send email to ${user.email}`);
          console.error(`Failed to send email to ${user.email}`);
        }

        // Add delay between users to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        results.failed++;
        const errorMsg = `Error processing user ${user.email}: ${error}`;
        results.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    console.log('Daily digest process completed:', results);
    return NextResponse.json({
      message: 'Daily digest process completed',
      results,
    });
  } catch (error) {
    console.error('Error in daily digest process:', error);
    return NextResponse.json(
      {
        error: 'Daily digest process failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
