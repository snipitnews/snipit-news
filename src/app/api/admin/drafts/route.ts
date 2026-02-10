import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';

async function checkAdmin() {
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
    return { authorized: false, email: null };
  }

  const { data: userData } = await getSupabaseAdmin()
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string }>();

  if (!userData || userData.role !== 'admin') {
    return { authorized: false, email: null };
  }

  return { authorized: true, email: user.email };
}

// GET - List drafts by date and optional status filter
export async function GET(request: NextRequest) {
  try {
    const { authorized } = await checkAdmin();
    if (!authorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const status = searchParams.get('status');

    if (!date) {
      return NextResponse.json(
        { error: 'date parameter is required (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();
    let query = admin
      .from('draft_summaries')
      .select('*')
      .eq('send_date', date)
      .order('topic', { ascending: true });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: drafts, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const typedDrafts = (drafts || []) as Array<{
      id: string;
      topic: string;
      send_date: string;
      is_paid: boolean;
      status: string;
      original_summaries: unknown;
      edited_summaries: unknown;
      is_edited: boolean;
      edited_by: string | null;
      approved_by: string | null;
      internal_note: string | null;
      created_at: string;
      updated_at: string;
    }>;

    const stats = {
      total: typedDrafts.length,
      draft: typedDrafts.filter((d) => d.status === 'draft').length,
      approved: typedDrafts.filter((d) => d.status === 'approved').length,
      rejected: typedDrafts.filter((d) => d.status === 'rejected').length,
    };

    return NextResponse.json({ drafts: typedDrafts, stats });
  } catch (error) {
    console.error('Error fetching drafts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update edited_summaries for a draft
export async function PUT(request: NextRequest) {
  try {
    const { authorized, email } = await checkAdmin();
    if (!authorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id, edited_summaries } = await request.json();

    if (!id || !edited_summaries) {
      return NextResponse.json(
        { error: 'id and edited_summaries are required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('draft_summaries')
      .update({
        edited_summaries,
        is_edited: true,
        edited_by: email,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ draft: data });
  } catch (error) {
    console.error('Error updating draft:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
