import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const { data, error } = await getSupabaseAdmin()
      .from('user_topics')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ topics: data });
  } catch (error) {
    console.error('Error fetching topics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, topicName } = await request.json();

    if (!userId || !topicName) {
      return NextResponse.json(
        { error: 'User ID and topic name are required' },
        { status: 400 }
      );
    }

    // Check current topic count
    const { data: currentTopics, error: countError } = await getSupabaseAdmin()
      .from('user_topics')
      .select('id')
      .eq('user_id', userId);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    // Get user's subscription tier
    const { data: user, error: userError } = await getSupabaseAdmin()
      .from('users')
      .select('subscription_tier, role')
      .eq('id', userId)
      .single<{ subscription_tier: string; role?: string }>();

    if (userError) {
      const errorMessage =
        userError instanceof Error ? userError.message : 'Unknown error';
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const maxTopics = user.role === 'admin' ? 10 : user.subscription_tier === 'paid' ? 12 : 3;

    if (currentTopics.length >= maxTopics) {
      return NextResponse.json(
        {
          error: `Topic limit exceeded. ${
            user.subscription_tier === 'paid' ? 'Pro' : 'Free'
          } tier allows ${maxTopics} topics.`,
        },
        { status: 400 }
      );
    }

    // Add the topic
    const { data, error } = await getSupabaseAdmin()
      .from('user_topics')
      .insert({
        user_id: userId,
        topic_name: topicName.trim(),
      } as never)
      .select()
      .single<{ id: string; user_id: string; topic_name: string }>();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ topic: data });
  } catch (error) {
    console.error('Error adding topic:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const topicId = searchParams.get('topicId');
    const userId = searchParams.get('userId');

    if (!topicId || !userId) {
      return NextResponse.json(
        { error: 'Topic ID and User ID are required' },
        { status: 400 }
      );
    }

    const { error } = await getSupabaseAdmin()
      .from('user_topics')
      .delete()
      .eq('id', topicId)
      .eq('user_id', userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting topic:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
