import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    
    // Check if user is authenticated
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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const adminClient = getSupabaseAdmin();
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single<{ role: string }>();

    if (userError || !userData || userData.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all users with their topics
    const { data: users, error: usersError } = await adminClient
      .from('users')
      .select(`
        id,
        email,
        subscription_tier,
        role,
        created_at,
        user_topics (
          id,
          topic_name,
          created_at
        )
      `)
      .order('created_at', { ascending: false });

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    // Format the response
    const formattedUsers = users.map((user: any) => ({
      id: user.id,
      email: user.email,
      tier: user.subscription_tier,
      role: user.role || 'user',
      createdAt: user.created_at,
      topics: user.user_topics || [],
      topicCount: user.user_topics?.length || 0,
    }));

    return NextResponse.json({ users: formattedUsers });
  } catch (error) {
    console.error('Error in admin users route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

