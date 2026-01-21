import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchNewsForTopic } from '@/lib/newsapi';
import { summarizeNews } from '@/lib/openai';

interface TopicInfo {
  topic_name: string;
  user_count: number;
}

// Get all unique topics across all users
async function getAllUserTopics(): Promise<TopicInfo[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('user_topics')
    .select('topic_name')
    .order('topic_name');

  if (error) {
    console.error('[Cache Warming] Error fetching user topics:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Count occurrences of each topic
  const topicCounts = new Map<string, number>();
  for (const row of data as { topic_name: string }[]) {
    const count = topicCounts.get(row.topic_name) || 0;
    topicCounts.set(row.topic_name, count + 1);
  }

  // Convert to array and sort by popularity
  const topicInfos: TopicInfo[] = Array.from(topicCounts.entries())
    .map(([topic_name, user_count]) => ({ topic_name, user_count }))
    .sort((a, b) => b.user_count - a.user_count);

  return topicInfos;
}

export async function GET(request: NextRequest) {
  // Verify this is a legitimate cron request
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    console.log('[Cache Warming] Starting cache warming process...');

    // Get all unique topics across all users
    const topics = await getAllUserTopics();

    if (topics.length === 0) {
      console.log('[Cache Warming] No topics to warm');
      return NextResponse.json({
        message: 'No topics to warm',
        executionTimeMs: Date.now() - startTime,
      });
    }

    console.log(`[Cache Warming] Found ${topics.length} unique topics to warm`);
    console.log(`[Cache Warming] Top 10 topics: ${topics.slice(0, 10).map(t => `${t.topic_name} (${t.user_count} users)`).join(', ')}`);

    const results = {
      total: topics.length,
      successful: 0,
      failed: 0,
      cached: 0,
      errors: [] as string[],
    };

    // Process each topic
    for (let i = 0; i < topics.length; i++) {
      const { topic_name, user_count } = topics[i];

      try {
        console.log(`[Cache Warming] Processing topic ${i + 1}/${topics.length}: "${topic_name}" (${user_count} users)`);

        // Fetch articles (this will cache them automatically)
        const articles = await fetchNewsForTopic(topic_name);

        if (articles.length === 0) {
          console.warn(`[Cache Warming] ⚠️ No articles found for "${topic_name}"`);
          results.failed++;
          results.errors.push(`No articles found for "${topic_name}"`);
          continue;
        }

        console.log(`[Cache Warming] Found ${articles.length} articles for "${topic_name}"`);

        // Generate and cache summaries for both tiers
        // The summarizeNews function handles caching internally
        const freeStartTime = Date.now();
        await summarizeNews(topic_name, articles, false); // Free tier
        const freeDuration = Date.now() - freeStartTime;
        console.log(`[Cache Warming] Generated free tier summary for "${topic_name}" (${freeDuration}ms)`);

        const paidStartTime = Date.now();
        await summarizeNews(topic_name, articles, true); // Paid tier
        const paidDuration = Date.now() - paidStartTime;
        console.log(`[Cache Warming] Generated paid tier summary for "${topic_name}" (${paidDuration}ms)`);

        results.successful++;
        results.cached += 2; // 2 cache entries (free + paid)

        // Add delay between topics to avoid overwhelming the system
        // and to respect API rate limits
        if (i < topics.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Cache Warming] ❌ Failed to warm cache for "${topic_name}":`, errorMessage);
        results.failed++;
        results.errors.push(`Failed to warm "${topic_name}": ${errorMessage}`);

        // If rate limited, wait longer
        if (errorMessage.includes('rate limit')) {
          console.log('[Cache Warming] Rate limited, waiting 5 seconds...');
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    }

    const executionTime = Date.now() - startTime;

    // Log execution to database
    try {
      const supabase = getSupabaseAdmin();
      await supabase.from('cron_job_logs').insert({
        status: results.failed > 0 && results.successful === 0 ? 'failed' : 'success',
        processed_count: results.total,
        successful_count: results.successful,
        failed_count: results.failed,
        skipped_count: 0,
        errors: results.errors,
        execution_time_ms: executionTime,
      } as never);

      console.log('[Cache Warming] Logged execution to database');
    } catch (logError) {
      console.error('[Cache Warming] Failed to log execution:', logError);
    }

    console.log(`[Cache Warming] ✅ Cache warming completed: ${results.successful}/${results.total} topics warmed, ${results.cached} cache entries created`);

    return NextResponse.json({
      message: 'Cache warming completed',
      results,
      executionTimeMs: executionTime,
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('[Cache Warming] ❌ Cache warming process failed:', error);

    // Log failure to database
    try {
      const supabase = getSupabaseAdmin();
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
      console.error('[Cache Warming] Failed to log failure:', logError);
    }

    return NextResponse.json(
      {
        error: 'Cache warming process failed',
        details: errorMessage,
        executionTimeMs: executionTime,
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
