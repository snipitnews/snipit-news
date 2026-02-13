import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchNewsForMultipleTopics } from '@/lib/newsapi';

interface TopicInfo {
  topic_name: string;
  user_count: number;
}

// Time budget: stop processing if we're within 20s of the 300s limit
const TIME_BUDGET_MS = 280000;

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

    const topicNames = topics.map(t => t.topic_name);

    // Time budget guard: only process topics we have time for
    const elapsed = Date.now() - startTime;
    if (elapsed >= TIME_BUDGET_MS) {
      console.warn('[Cache Warming] Time budget exceeded before fetching news');
      return NextResponse.json({
        message: 'Time budget exceeded before processing',
        executionTimeMs: elapsed,
      });
    }

    // Use fetchNewsForMultipleTopics which handles batching (5 topics in parallel)
    console.log(`[Cache Warming] Fetching news for ${topicNames.length} topics using parallel batching...`);
    const newsData = await fetchNewsForMultipleTopics(topicNames);

    const successful = Object.entries(newsData).filter(([, articles]) => articles.length > 0).length;
    const failed = topicNames.length - successful;
    const errors: string[] = [];

    for (const topic of topicNames) {
      if (!newsData[topic] || newsData[topic].length === 0) {
        errors.push(`No articles found for "${topic}"`);
      }
    }

    const executionTime = Date.now() - startTime;

    // Log execution to database
    try {
      const supabase = getSupabaseAdmin();
      await supabase.from('cron_job_logs').insert({
        status: failed > 0 && successful === 0 ? 'failed' : 'success',
        processed_count: topicNames.length,
        successful_count: successful,
        failed_count: failed,
        skipped_count: 0,
        errors,
        execution_time_ms: executionTime,
      } as never);

      console.log('[Cache Warming] Logged execution to database');
    } catch (logError) {
      console.error('[Cache Warming] Failed to log execution:', logError);
    }

    console.log(`[Cache Warming] Cache warming completed: ${successful}/${topicNames.length} topics warmed in ${executionTime}ms`);

    return NextResponse.json({
      message: 'Cache warming completed',
      results: {
        total: topicNames.length,
        successful,
        failed,
        errors,
      },
      executionTimeMs: executionTime,
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('[Cache Warming] Cache warming process failed:', error);

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
