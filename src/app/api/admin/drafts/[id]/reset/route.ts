import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { data: userData } = await getSupabaseAdmin()
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single<{ role: string }>();

    if (!userData || userData.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const admin = getSupabaseAdmin();

    // First get the original_summaries
    const { data: existing, error: fetchError } = await admin
      .from('draft_summaries')
      .select('original_summaries')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      );
    }

    const { data, error } = await admin
      .from('draft_summaries')
      .update({
        edited_summaries: (existing as { original_summaries: unknown }).original_summaries,
        is_edited: false,
        status: 'draft',
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
    console.error('Error resetting draft:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
