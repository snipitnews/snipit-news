import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchNewsForMultipleTopics } from '@/lib/newsapi';
import { summarizeNews } from '@/lib/openai';
import { sendNewsDigest } from '@/lib/email';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    
    // Create a server client with cookie handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // No-op for read-only auth operations
          },
        },
      }
    );

    // Get the current user (authenticated via getUser)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user data
    const { data: userData, error: userError } = await getSupabaseAdmin()
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single<{ role: string; [key: string]: any }>();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Only admins are allowed to trigger test emails
    if (userData.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden. Only admins can send test emails.' },
        { status: 403 }
      );
    }

    // Get user's topics
    const { data: topicsData, error: topicsError } = await getSupabaseAdmin()
      .from('user_topics')
      .select('topic_name')
      .eq('user_id', user.id);

    if (topicsError || !topicsData || topicsData.length === 0) {
      return NextResponse.json(
        { error: 'No topics found. Please add topics first.' },
        { status: 400 }
      );
    }

    const topics = (topicsData as { topic_name: string }[]).map((t) => t.topic_name);
    console.log(`[Test Email] Testing for user ${userData.email} with topics: ${topics.join(', ')}`);

    // Fetch news for all topics
    console.log(`[Test Email] Fetching news for ${topics.length} topics...`);
    const newsData = await fetchNewsForMultipleTopics(topics);
    
    // Log article counts
    Object.entries(newsData).forEach(([topic, articles]) => {
      console.log(`[Test Email] Found ${articles.length} articles for topic: ${topic}`);
    });

    // Generate summaries for each topic
    console.log(`[Test Email] Generating summaries...`);
    const summaries = [];
    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];
      const articles = newsData[topic] || [];
      
      if (articles.length > 0) {
        console.log(`[Test Email] Summarizing topic ${i + 1}/${topics.length}: ${topic} (${articles.length} articles)`);
        try {
          const summary = await summarizeNews(
            topic,
            articles,
            userData.subscription_tier === 'paid'
          );
          if (summary.summaries.length > 0) {
            summaries.push(summary);
            console.log(`[Test Email] ✅ Generated ${summary.summaries.length} summaries for ${topic}`);
          } else {
            console.log(`[Test Email] ⚠️ No summaries generated for ${topic}`);
          }
        } catch (error) {
          console.error(`[Test Email] ❌ Error summarizing ${topic}:`, error);
          // Continue with other topics even if one fails
        }
      } else {
        console.log(`[Test Email] ⚠️ No articles found for topic: ${topic}`);
      }
    }
    
    console.log(`[Test Email] Generated summaries for ${summaries.length}/${topics.length} topics`);

    if (summaries.length === 0) {
      return NextResponse.json(
        {
          error: 'No news found for your topics. Try again later or check your topic names.',
          details: 'No articles were found or summarized for the selected topics.',
        },
        { status: 400 }
      );
    }

    // Send email digest
    console.log(`[Test Email] Sending email to ${userData.email}...`);
    const emailResult = await sendNewsDigest(
      userData.email,
      summaries,
      userData.subscription_tier === 'paid'
    );

    if (emailResult.success) {
      // Store in email archive
      try {
        await getSupabaseAdmin()
          .from('email_archive')
          .insert({
            user_id: userData.id,
            subject: `Your SnipIt Daily Digest - ${new Date().toLocaleDateString()}`,
            content: summaries as unknown,
            topics: topics,
          } as never);
        console.log(`[Test Email] ✅ Email archived successfully`);
      } catch (archiveError) {
        console.error('[Test Email] ⚠️ Failed to archive email:', archiveError);
        // Don't fail the request if archiving fails
      }

      console.log(`[Test Email] ✅ Test email sent successfully!`);
      return NextResponse.json({
        success: true,
        message: `Test email sent successfully to ${userData.email}!`,
        topics: topics,
        summariesCount: summaries.length,
      });
    } else {
      const errorMsg = emailResult.error || 'Unknown error';
      console.error(`[Test Email] ❌ Failed to send email: ${errorMsg}`, emailResult.details);
      return NextResponse.json(
        {
          error: 'Failed to send email',
          details: errorMsg,
          resendDetails: emailResult.details,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in test email:', error);
    return NextResponse.json(
      {
        error: 'Failed to send test email',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

