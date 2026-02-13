import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

interface ArticleCacheEntry {
  topic: string;
  source: string;
  articles: unknown;
  fetch_duration_ms: number | null;
  created_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = getSupabaseAdmin();
    const { data: userData } = await adminClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single<{ role: string }>();

    if (!userData || userData.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const today = new Date().toISOString().split('T')[0];

    // Get all unique topics that users are subscribed to
    const { data: userTopics } = await adminClient
      .from('user_topics')
      .select('topic_name');

    const allUserTopics = Array.from(
      new Set((userTopics || []).map((t: { topic_name: string }) => t.topic_name))
    ).sort();

    // Get today's article cache entries (these are the fetched + ranked articles)
    const { data: cacheEntries } = await adminClient
      .from('article_cache')
      .select('topic, source, articles, fetch_duration_ms, created_at')
      .eq('date', today)
      .order('topic');

    // Build a map of topic -> cache data
    const topicCache = new Map<string, ArticleCacheEntry[]>();
    for (const entry of (cacheEntries || []) as ArticleCacheEntry[]) {
      if (!topicCache.has(entry.topic)) {
        topicCache.set(entry.topic, []);
      }
      topicCache.get(entry.topic)!.push(entry);
    }

    // Get today's email archive to see what summaries were actually sent
    const todayStart = new Date(today + 'T00:00:00Z').toISOString();
    const todayEnd = new Date(today + 'T23:59:59Z').toISOString();

    const { data: archiveEntries } = await adminClient
      .from('email_archive')
      .select('topics, content, sent_at')
      .gte('sent_at', todayStart)
      .lte('sent_at', todayEnd) as { data: Array<{ topics: string[]; content: unknown; sent_at: string }> | null };

    // Aggregate summaries by topic from all emails sent today
    type SummaryItem = { title: string; summary: string; bullets?: string[]; url: string; source: string };
    type TopicContent = { topic: string; summaries: SummaryItem[] };
    const topicSummaries = new Map<string, SummaryItem[]>();
    for (const archive of (archiveEntries || [])) {
      const content = archive.content as TopicContent[];
      if (Array.isArray(content)) {
        for (const topicSummary of content) {
          if (!topicSummaries.has(topicSummary.topic)) {
            topicSummaries.set(topicSummary.topic, topicSummary.summaries || []);
          }
        }
      }
    }

    // Build response: for each user topic, show status + data
    const topicResults = allUserTopics.map((topicName: string) => {
      const cacheData = topicCache.get(topicName);
      const summaries = topicSummaries.get(topicName);

      // Get the final articles (from multi-source-editorial or multi-source-deterministic)
      const finalCache = cacheData?.find(
        (c) => c.source.startsWith('multi-source')
      );
      const articles = finalCache
        ? (finalCache.articles as Array<{ title: string; url: string; source: { name: string }; publishedAt: string }>)
        : [];

      const hasArticles = articles.length > 0;
      const hasSummaries = summaries && summaries.length > 0;
      const isEditorial = finalCache?.source === 'multi-source-editorial';

      return {
        topic: topicName,
        status: hasSummaries ? 'sent' : hasArticles ? 'cached' : 'failed',
        articleCount: articles.length,
        summaryCount: summaries?.length || 0,
        isEditorial,
        fetchDurationMs: finalCache?.fetch_duration_ms || null,
        cachedAt: finalCache?.created_at || null,
        articles: articles.slice(0, 7).map((a) => ({
          title: a.title,
          url: a.url,
          source: a.source?.name || 'Unknown',
          publishedAt: a.publishedAt,
        })),
        summaries: summaries?.map((s) => ({
          title: s.title,
          summary: s.summary,
          bullets: s.bullets,
          url: s.url,
          source: s.source,
        })) || [],
      };
    });

    return NextResponse.json({
      date: today,
      totalTopics: allUserTopics.length,
      withArticles: topicResults.filter((t) => t.articleCount > 0).length,
      withSummaries: topicResults.filter((t) => t.summaryCount > 0).length,
      failed: topicResults.filter((t) => t.status === 'failed').length,
      topics: topicResults,
      emailsSentToday: (archiveEntries || []).length,
    });
  } catch (error) {
    console.error('Error fetching admin summaries:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
