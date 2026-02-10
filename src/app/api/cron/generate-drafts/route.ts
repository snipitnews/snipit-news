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
    console.error('[Generate Drafts] Error fetching user topics:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    return [];
  }

  const topicCounts = new Map<string, number>();
  for (const row of data as { topic_name: string }[]) {
    const count = topicCounts.get(row.topic_name) || 0;
    topicCounts.set(row.topic_name, count + 1);
  }

  const topicInfos: TopicInfo[] = Array.from(topicCounts.entries())
    .map(([topic_name, user_count]) => ({ topic_name, user_count }))
    .sort((a, b) => b.user_count - a.user_count);

  return topicInfos;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    console.log('[Generate Drafts] Starting draft generation...');

    // Calculate sendDate = tomorrow in EST (America/New_York)
    const nowEST = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    nowEST.setDate(nowEST.getDate() + 1);
    const sendDate = `${nowEST.getFullYear()}-${String(nowEST.getMonth() + 1).padStart(2, '0')}-${String(nowEST.getDate()).padStart(2, '0')}`;
    console.log(`[Generate Drafts] Generating drafts for send date: ${sendDate}`);

    const topics = await getAllUserTopics();

    if (topics.length === 0) {
      console.log('[Generate Drafts] No topics to generate drafts for');
      return NextResponse.json({
        message: 'No topics found',
        executionTimeMs: Date.now() - startTime,
      });
    }

    console.log(`[Generate Drafts] Found ${topics.length} unique topics`);

    const results = {
      total: topics.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    const supabase = getSupabaseAdmin();

    for (let i = 0; i < topics.length; i++) {
      const { topic_name } = topics[i];

      try {
        console.log(`[Generate Drafts] Processing topic ${i + 1}/${topics.length}: "${topic_name}"`);

        // Force fresh fetch (no cache read), but write to cache for reuse
        const articles = await fetchNewsForTopic(topic_name, {
          useCache: false,
          writeCache: true,
        });

        if (articles.length === 0) {
          console.warn(`[Generate Drafts] No articles found for "${topic_name}"`);
          results.skipped++;
          continue;
        }

        console.log(`[Generate Drafts] Found ${articles.length} articles for "${topic_name}"`);

        // Generate free-tier summary only
        const summary = await summarizeNews(topic_name, articles, false);

        if (!summary || summary.summaries.length === 0) {
          console.warn(`[Generate Drafts] Empty summary for "${topic_name}"`);
          results.skipped++;
          continue;
        }

        // Check if an existing draft exists for this topic+date
        const { data: existing } = await supabase
          .from('draft_summaries')
          .select('id, is_edited')
          .eq('topic', topic_name)
          .eq('send_date', sendDate)
          .eq('is_paid', false)
          .single();

        if (existing) {
          const existingDraft = existing as { id: string; is_edited: boolean };

          if (existingDraft.is_edited) {
            // Preserve human edits, only update original
            await supabase
              .from('draft_summaries')
              .update({
                original_summaries: summary.summaries,
                updated_at: new Date().toISOString(),
              } as never)
              .eq('id', existingDraft.id);

            console.log(`[Generate Drafts] Updated original_summaries for "${topic_name}" (preserved edits)`);
          } else {
            // Update both columns
            await supabase
              .from('draft_summaries')
              .update({
                original_summaries: summary.summaries,
                edited_summaries: summary.summaries,
                status: 'draft',
                updated_at: new Date().toISOString(),
              } as never)
              .eq('id', existingDraft.id);

            console.log(`[Generate Drafts] Updated draft for "${topic_name}"`);
          }
        } else {
          // Insert new draft
          await supabase
            .from('draft_summaries')
            .insert({
              topic: topic_name,
              send_date: sendDate,
              is_paid: false,
              status: 'draft',
              original_summaries: summary.summaries,
              edited_summaries: summary.summaries,
            } as never);

          console.log(`[Generate Drafts] Created new draft for "${topic_name}"`);
        }

        results.successful++;

        // Delay between topics to respect rate limits
        if (i < topics.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Generate Drafts] Failed for "${topic_name}":`, errorMessage);
        results.failed++;
        results.errors.push(`Failed for "${topic_name}": ${errorMessage}`);

        if (errorMessage.includes('rate limit')) {
          console.log('[Generate Drafts] Rate limited, waiting 5 seconds...');
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    }

    const executionTime = Date.now() - startTime;

    // Log execution
    try {
      await supabase.from('cron_job_logs').insert({
        status: results.failed > 0 && results.successful === 0 ? 'failed' : 'success',
        processed_count: results.total,
        successful_count: results.successful,
        failed_count: results.failed,
        skipped_count: results.skipped,
        errors: results.errors,
        execution_time_ms: executionTime,
      } as never);
    } catch (logError) {
      console.error('[Generate Drafts] Failed to log execution:', logError);
    }

    console.log(`[Generate Drafts] Completed: ${results.successful}/${results.total} drafts generated in ${executionTime}ms`);

    return NextResponse.json({
      message: 'Draft generation completed',
      sendDate,
      results,
      executionTimeMs: executionTime,
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('[Generate Drafts] Fatal error:', error);

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
      console.error('[Generate Drafts] Failed to log failure:', logError);
    }

    return NextResponse.json(
      {
        error: 'Draft generation failed',
        details: errorMessage,
        executionTimeMs: executionTime,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
