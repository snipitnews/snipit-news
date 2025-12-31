import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase';
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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // Delete related data in a safe order
    const userId = user.id;

    // Wrap in try/catch per step to log but still fail clearly if something breaks
    const errors: string[] = [];

    // Delete user_topics
    const { error: topicsError } = await admin
      .from('user_topics')
      .delete()
      .eq('user_id', userId);
    if (topicsError) {
      console.error('Error deleting user_topics for account deletion:', topicsError);
      errors.push('topics');
    }

    // Delete email settings
    const { error: settingsError } = await admin
      .from('user_email_settings')
      .delete()
      .eq('user_id', userId);
    if (settingsError) {
      console.error('Error deleting user_email_settings for account deletion:', settingsError);
      errors.push('email settings');
    }

    // Delete email archive
    const { error: archiveError } = await admin
      .from('email_archive')
      .delete()
      .eq('user_id', userId);
    if (archiveError) {
      console.error('Error deleting email_archive for account deletion:', archiveError);
      errors.push('email archive');
    }

    // Delete subscription metadata (if any)
    const { error: subMetaError } = await admin
      .from('subscription_metadata')
      .delete()
      .eq('user_id', userId);
    if (subMetaError) {
      console.error('Error deleting subscription_metadata for account deletion:', subMetaError);
      errors.push('subscription metadata');
    }

    // Finally, delete the user row from our public.users table
    const { error: userRowError } = await admin
      .from('users')
      .delete()
      .eq('id', userId);
    if (userRowError) {
      console.error('Error deleting user row for account deletion:', userRowError);
      errors.push('user');
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          error: 'Failed to delete some account data',
          details: `Failed parts: ${errors.join(', ')}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


