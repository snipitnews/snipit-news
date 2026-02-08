import { NextRequest, NextResponse } from 'next/server';
import { fetchNewsForTopic } from '@/lib/newsapi';
import { summarizeNews } from '@/lib/openai';

/**
 * Test endpoint for news summary algorithm
 * 
 * Usage with curl:
 *   curl "http://localhost:3000/api/test-news-summary?topic=nba"
 *   curl "http://localhost:3000/api/test-news-summary?topic=nba&nocache=1"
 * 
 * Returns JSON with just the summary bullets for the specified topic
 */
export async function GET(request: NextRequest) {
  try {
    // Get topic from query parameter
    const topic = request.nextUrl.searchParams.get('topic');
    const noCacheParam = request.nextUrl.searchParams.get('nocache');
    const noCache = noCacheParam === '1' || noCacheParam === 'true';

    if (!topic) {
      return NextResponse.json(
        {
          error: 'Topic parameter is required',
          usage: 'GET /api/test-news-summary?topic=<topic_name>',
          example: 'GET /api/test-news-summary?topic=nba',
        },
        { status: 400 }
      );
    }

    console.log(`[Test News Summary] Testing news summary algorithm for topic: "${topic}"`);

    // Fetch news articles for the topic
    console.log(`[Test News Summary] Fetching news articles...`);
    const articles = await fetchNewsForTopic(topic, {
      useCache: !noCache,
      writeCache: !noCache,
    });

    if (articles.length === 0) {
      return NextResponse.json(
        {
          topic,
          error: 'No articles found for this topic',
          articlesFound: 0,
          summaries: [],
        },
        { status: 404 }
      );
    }

    console.log(`[Test News Summary] Found ${articles.length} articles`);

    // Generate summaries (using free tier format by default)
    console.log(`[Test News Summary] Generating summaries...`);
    let summary;
    try {
      summary = await summarizeNews(topic, articles, false);
    } catch (error) {
      console.error(`[Test News Summary] Error during summarization:`, error);
      return NextResponse.json(
        {
          topic,
          error: 'Failed to generate summaries',
          articlesFound: articles.length,
          errorDetails: error instanceof Error ? error.message : String(error),
          summaries: [],
        },
        { status: 500 }
      );
    }

    if (summary.summaries.length === 0) {
      console.warn(`[Test News Summary] No summaries generated despite ${articles.length} articles found`);
      return NextResponse.json(
        {
          topic,
          error: 'No summaries generated',
          articlesFound: articles.length,
          summaries: [],
          hint: 'Check console logs for [OpenAI] warnings about invalid summaries',
        },
        { status: 404 }
      );
    }

    console.log(`[Test News Summary] Generated ${summary.summaries.length} summaries`);

    // Extract just the bullets from each summary
    const bullets = summary.summaries.map((s) => ({
      title: s.title,
      bullets: s.bullets || [],
      url: s.url,
      source: s.source,
    }));

    // Return prettified JSON for better readability in curl/browser
    return new NextResponse(
      JSON.stringify(
        {
          topic,
          articlesFound: articles.length,
          summariesCount: summary.summaries.length,
          summaries: bullets,
        },
        null,
        2
      ),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('[Test News Summary] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate news summary',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

