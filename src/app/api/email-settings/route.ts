import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';

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
          // Delivery time is fixed globally to 8:30 AM EST
          delivery_time: '08:30:00-05:00',
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
    const { paused } = body;

    // Update or insert settings
    const { data, error } = await getSupabaseAdmin()
      .from('user_email_settings')
      .upsert(
        {
          user_id: user.id,
          // Delivery time and timezone are fixed globally to 8:30 AM EST
          delivery_time: '08:30:00-05:00',
          timezone: 'America/New_York',
          paused: paused !== undefined ? paused : false,
          updated_at: new Date().toISOString(),
        } as never,
        {
          onConflict: 'user_id',
        }
      )
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
