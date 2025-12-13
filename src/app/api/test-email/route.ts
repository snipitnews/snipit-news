import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchNewsForMultipleTopics } from '@/lib/newsapi';
import { summarizeNews } from '@/lib/openai';
import { sendNewsDigest } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    // Create a response object for setting cookies
    let response = NextResponse.next();
    
    // Create a server client with cookie handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            request.cookies.set({
              name,
              value,
              ...options,
            });
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            response.cookies.set({
              name,
              value,
              ...options,
            });
          },
          remove(name: string, options: any) {
            request.cookies.set({
              name,
              value: '',
              ...options,
            });
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            response.cookies.set({
              name,
              value: '',
              ...options,
            });
          },
        },
      }
    );

    // Get the current user from the session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user data
    const { data: userData, error: userError } = await getSupabaseAdmin()
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get user's topics
    const { data: topicsData, error: topicsError } = await getSupabaseAdmin()
      .from('user_topics')
      .select('topic_name')
      .eq('user_id', session.user.id);

    if (topicsError || !topicsData || topicsData.length === 0) {
      return NextResponse.json(
        { error: 'No topics found. Please add topics first.' },
        { status: 400 }
      );
    }

    const topics = topicsData.map((t) => t.topic_name);
    console.log(`Testing email for user ${userData.email} with topics: ${topics.join(', ')}`);

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
          userData.subscription_tier === 'paid'
        );
        if (summary.summaries.length > 0) {
          summaries.push(summary);
        }
      }
    }

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
    const emailSent = await sendNewsDigest(
      userData.email,
      summaries,
      userData.subscription_tier === 'paid'
    );

    if (emailSent) {
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
      } catch (archiveError) {
        console.error('Failed to archive email:', archiveError);
      }

      return NextResponse.json({
        success: true,
        message: `Test email sent successfully to ${userData.email}!`,
        topics: topics,
        summariesCount: summaries.length,
      });
    } else {
      return NextResponse.json(
        {
          error: 'Failed to send email',
          details: 'Check your Resend API key and configuration.',
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

