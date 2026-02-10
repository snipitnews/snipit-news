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
    return false;
  }

  const { data: userData } = await getSupabaseAdmin()
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string }>();

  return userData?.role === 'admin';
}

// GET - Get draft settings
export async function GET() {
  try {
    const authorized = await checkAdmin();
    if (!authorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('draft_settings')
      .select('key, value');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const settings: Record<string, string> = {};
    for (const row of (data || []) as Array<{ key: string; value: string }>) {
      settings[row.key] = row.value;
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error fetching draft settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update a draft setting
export async function PUT(request: NextRequest) {
  try {
    const authorized = await checkAdmin();
    if (!authorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { key, value } = await request.json();

    if (!key || !value) {
      return NextResponse.json(
        { error: 'key and value are required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from('draft_settings')
      .update({
        value,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('key', key);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating draft setting:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
