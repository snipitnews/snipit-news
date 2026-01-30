import { NextRequest, NextResponse } from 'next/server';
import { fetchSportsScores, prioritizeScores } from '@/lib/sportsScores';
import { fetchNewsForMultipleTopics } from '@/lib/newsapi';
import { summarizeNews } from '@/lib/openai';

/**
 * Test endpoint to see NBA scores + article summaries
 * No authentication required (dev only)
 */
export async function GET(request: NextRequest) {
  try {
    const topic = 'nba'; // Test with NBA
    const isPaid = request.nextUrl.searchParams.get('paid') === 'true';
    
    console.log(`[Test NBA] Testing topic: ${topic}, tier: ${isPaid ? 'paid' : 'free'}`);

    // Step 1: Fetch sports scores from TheSportsDB
    console.log(`[Test NBA] Step 1: Fetching scores from TheSportsDB...`);
    const rawScoresData = await fetchSportsScores(topic);
    const prioritizedScores = prioritizeScores(rawScoresData.scores, 3);
    console.log(`[Test NBA] Found ${prioritizedScores.length} scores from night prior/last week`);

    // Step 2: Fetch articles from NewsAPI
    console.log(`[Test NBA] Step 2: Fetching articles from NewsAPI...`);
    const newsData = await fetchNewsForMultipleTopics([topic]);
    const articles = newsData[topic] || [];
    console.log(`[Test NBA] Found ${articles.length} articles`);

    // Step 3: Generate summaries (this will include scores in the prompt)
    console.log(`[Test NBA] Step 3: Generating summaries with scores included...`);
    let summary = null;
    if (articles.length > 0) {
      summary = await summarizeNews(topic, articles, isPaid);
      console.log(`[Test NBA] Generated ${summary.summaries.length} summaries`);
    }

    // Return the full output
    return NextResponse.json({
      success: true,
      topic,
      tier: isPaid ? 'paid' : 'free',
      flow: {
        step1_scores: {
          description: 'Top 3 scores from TheSportsDB (night prior or last week)',
          count: prioritizedScores.length,
          scores: prioritizedScores.map(s => ({
            game: `${s.awayTeam} ${s.awayScore} - ${s.homeScore} ${s.homeTeam}`,
            status: s.status,
            date: s.date,
            league: s.league
          }))
        },
        step2_articles: {
          description: 'Articles fetched from NewsAPI/CurrentsAPI',
          count: articles.length,
          sample: articles.slice(0, 3).map(a => ({
            title: a.title,
            source: a.source.name
          }))
        },
        step3_summaries: {
          description: 'Final summaries (scores prioritized first, then article summaries)',
          count: summary?.summaries.length || 0,
          summaries: summary?.summaries || []
        }
      },
      // Show how scores appear in the prompt
      scoresInPrompt: prioritizedScores.length > 0 ? prioritizedScores.map((score, idx) => 
        `${idx + 1}. ${score.awayTeam} ${score.awayScore} - ${score.homeScore} ${score.homeTeam} (${score.status})`
      ).join('\n') : 'No scores found',
      note: 'The AI will prioritize these scores FIRST, then add article summaries below'
    });
  } catch (error) {
    console.error('[Test NBA] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
