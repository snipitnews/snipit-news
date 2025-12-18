import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';

// GET all topics
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
          setAll() {
            // No-op for GET requests
          },
        },
      }
    );

    // Check if user is admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await getSupabaseAdmin()
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || userData.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all topics
    const { data: topics, error } = await getSupabaseAdmin()
      .from('topics')
      .select('*')
      .order('main_category', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by main category
    const groupedTopics: Record<string, typeof topics> = {};
    topics?.forEach((topic) => {
      if (!groupedTopics[topic.main_category]) {
        groupedTopics[topic.main_category] = [];
      }
      groupedTopics[topic.main_category].push(topic);
    });

    return NextResponse.json({ topics, groupedTopics });
  } catch (error) {
    console.error('Error fetching topics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Add new topic
export async function POST(request: NextRequest) {
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
          setAll() {
            // No-op for POST requests
          },
        },
      }
    );

    // Check if user is admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await getSupabaseAdmin()
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || userData.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, main_category } = await request.json();

    if (!name || !main_category) {
      return NextResponse.json(
        { error: 'Topic name and main category are required' },
        { status: 400 }
      );
    }

    // Insert new topic
    const { data, error } = await getSupabaseAdmin()
      .from('topics')
      .insert({
        name: name.trim(),
        main_category: main_category.trim(),
        is_active: true,
      } as never)
      .select()
      .single();

    if (error) {
      if (error.message.includes('unique constraint')) {
        return NextResponse.json(
          { error: 'Topic already exists' },
          { status: 400 }
        );
      }
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

