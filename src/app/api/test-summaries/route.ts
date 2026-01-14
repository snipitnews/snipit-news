import { NextRequest, NextResponse } from 'next/server';
import { type NewsSummary } from '@/lib/openai';
import { sendNewsDigest } from '@/lib/email';

// This endpoint is ONLY for testing the email template.
// It uses static summaries and does NOT call OpenAI or NewsAPI.
export async function GET(request: NextRequest) {
  try {
    const staticSummaries: NewsSummary[] = [
      {
        topic: 'Artificial Intelligence',
        summaries: [
          {
            title: 'How iRobot lost its way home',
            summary:
              'iRobot, once a pioneer in home robotics, is struggling to navigate shifting market expectations, regulatory challenges, and intensified competition.',
            bullets: [
              'iRobot’s early lead in consumer robotics has eroded as rivals undercut pricing and introduce feature-rich alternatives.',
            ],
            url: 'https://example.com/ai-irobot',
            source: 'Example Tech',
          },
          {
            title: 'AI regulation inches forward',
            summary:
              'Regulators in the US and EU are moving toward concrete AI rules, forcing companies to adapt compliance and safety practices.',
            bullets: [
              'Draft legislation focuses on transparency, model risk, and clear accountability for high‑risk AI deployments.',
            ],
            url: 'https://example.com/ai-regulation',
            source: 'Policy Weekly',
          },
          {
            title: 'Enterprises shift from AI pilots to production',
            summary:
              'Large companies are finally moving generative AI from small pilots into core workflows, prioritizing measurable ROI and reliability.',
            bullets: [
              'CIOs report consolidation around a smaller set of trusted models, with emphasis on security, governance, and cost control.',
            ],
            url: 'https://example.com/ai-enterprise',
            source: 'Enterprise Review',
          },
        ],
      },
      {
        topic: 'Global Politics',
        summaries: [
          {
            title: 'Central banks balance inflation and growth',
            summary:
              'Major central banks are signalling a slower pace of rate cuts as inflation cools unevenly across regions.',
            bullets: [
              'Policy makers are trying to avoid reigniting inflation while preventing a sharp slowdown in already fragile economies.',
            ],
            url: 'https://example.com/global-fed',
            source: 'Global Markets Daily',
          },
          {
            title: 'Allies coordinate on critical supply chains',
            summary:
              'Democracies are deepening cooperation on semiconductors, clean energy and rare earths to reduce dependence on single‑country suppliers.',
            bullets: [
              'New agreements target shared investment, joint research, and better resilience against geopolitical shocks.',
            ],
            url: 'https://example.com/global-supply',
            source: 'World Brief',
          },
          {
            title: 'Ceasefire talks resume amid fragile truces',
            summary:
              'Mediators are trying to turn temporary pauses in several conflict zones into longer‑term political arrangements.',
            bullets: [
              'Progress remains uneven, with local actors weighing domestic pressure against international incentives for stability.',
            ],
            url: 'https://example.com/global-ceasefire',
            source: 'Diplomacy Monitor',
          },
        ],
      },
      {
        topic: 'NBA',
        summaries: [
          {
            title: 'Surging young cores reshape the playoff picture',
            summary:
              'Several teams built around recent draft picks are climbing the standings faster than expected.',
            bullets: [
              'Front offices are doubling down on player development, spacing and pace instead of chasing aging veterans.',
            ],
            url: 'https://example.com/nba-young-cores',
            source: 'Hoops Report',
          },
          {
            title: 'Superstars adjust to new rest and tax rules',
            summary:
              'Stricter resting policies and a harsher luxury tax are forcing contenders to rethink roster construction.',
            bullets: [
              'Teams are spreading minutes more evenly and prioritizing depth to stay competitive across the full 82‑game schedule.',
            ],
            url: 'https://example.com/nba-rules',
            source: 'League Insider',
          },
          {
            title: 'Three‑point volume continues to climb',
            summary:
              'Offenses are generating a record share of shots from beyond the arc, pushing defenses to switch and scramble more often.',
            bullets: [
              'Coaches are emphasizing versatile wings and bigs who can both space the floor and survive on switches.',
            ],
            url: 'https://example.com/nba-threes',
            source: 'Analytics Weekly',
          },
        ],
      },
    ];

    const emailParam = request.nextUrl.searchParams.get('email');
    const sendEmail = request.nextUrl.searchParams.get('send') === 'true';

    let emailSent = false;
    if (sendEmail && emailParam) {
      try {
        console.log(`[Test Summaries] Sending static test email to ${emailParam}...`);
        const result = await sendNewsDigest(emailParam, staticSummaries, false); // false = free tier
        emailSent = result.success;
        console.log(`[Test Summaries] Email sent: ${emailSent}`);
        if (!result.success && result.error) {
          console.error(`[Test Summaries] Email error: ${result.error}`);
        }
      } catch (error) {
        console.error('[Test Summaries] Error sending static test email:', error);
      }
    }

    return NextResponse.json({
      success: true,
      emailSent,
      summaries: staticSummaries,
    });
  } catch (error) {
    console.error('[Test Summaries] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


