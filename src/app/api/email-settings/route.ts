import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';

const VALID_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
];

const TIMEZONE_OFFSETS: Record<string, string> = {
  'America/New_York': '-05:00',
  'America/Chicago': '-06:00',
  'America/Denver': '-07:00',
  'America/Los_Angeles': '-08:00',
};

export async function GET(request: NextRequest) {
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
            // No-op for read-only operations in GET requests
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error('Auth error in email-settings GET:', authError);
      return NextResponse.json({ error: 'Unauthorized', details: authError.message }, { status: 401 });
    }

    if (!user) {
      console.error('No user found in email-settings GET');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Fetching email settings for user:', user.id);

    type EmailSettings = {
      user_id: string;
      delivery_time: string;
      timezone: string;
      paused: boolean;
      updated_at?: string;
    };

    const { data, error } = await getSupabaseAdmin()
      .from('user_email_settings')
      .select('*')
      .eq('user_id', user.id)
      .single<EmailSettings>();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" - we'll create default settings
      console.error('Error fetching email settings:', error);
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }

    // If no settings exist, create default ones
    if (!data) {
      console.log('No email settings found, creating default settings for user:', user.id);
      const { data: newSettings, error: createError } = await getSupabaseAdmin()
        .from('user_email_settings')
        .insert({
          user_id: user.id,
          delivery_time: '06:45:00-05:00',
          timezone: 'America/New_York',
          paused: false,
        } as never)
        .select()
        .single<EmailSettings>();

      if (createError) {
        console.error('Error creating email settings:', createError);
        return NextResponse.json(
          { error: createError.message, code: createError.code },
          { status: 500 }
        );
      }

      return NextResponse.json({ settings: newSettings });
    }

    return NextResponse.json({ settings: data });
  } catch (error) {
    console.error('Error fetching email settings (catch block):', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage, stack: errorStack },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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
            // No-op for read-only auth operations in PUT requests
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

    const body = await request.json();
    const { paused, timezone } = body;

    // Build update payload — only include fields that were provided
    const updatePayload: Record<string, unknown> = {
      user_id: user.id,
      updated_at: new Date().toISOString(),
    };

    if (paused !== undefined) {
      updatePayload.paused = paused;
    }

    if (timezone !== undefined) {
      if (!VALID_TIMEZONES.includes(timezone)) {
        return NextResponse.json(
          { error: 'Invalid timezone. Must be one of: ' + VALID_TIMEZONES.join(', ') },
          { status: 400 }
        );
      }
      updatePayload.timezone = timezone;
      const utcOffset = TIMEZONE_OFFSETS[timezone] || '-05:00';
      updatePayload.delivery_time = `06:45:00${utcOffset}`;
    }

    const { data, error } = await getSupabaseAdmin()
      .from('user_email_settings')
      .update(updatePayload as never)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ settings: data });
  } catch (error) {
    console.error('Error updating email settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
