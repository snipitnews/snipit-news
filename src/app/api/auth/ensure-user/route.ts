import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { userId, email, timezone } = await request.json();

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'User ID and email are required' },
        { status: 400 }
      );
    }

    // Use detected timezone or default to EST
    const userTimezone = timezone || 'America/New_York';

    // Ensure user record exists
    await getSupabaseAdmin()
      .from('users')
      .upsert(
        {
          id: userId,
          email: email,
          subscription_tier: 'free',
        } as never,
        {
          onConflict: 'id',
        }
      );

    // Ensure email settings exist with user's timezone
    // Only update timezone if it's a new user (not updating existing)
    const { data: existingSettings } = await getSupabaseAdmin()
      .from('user_email_settings')
      .select('timezone')
      .eq('user_id', userId)
      .single<{ timezone: string }>();

    await getSupabaseAdmin()
      .from('user_email_settings')
      .upsert(
        {
          user_id: userId,
          delivery_time: '06:30:00-05:00', // 6:30 AM (will be interpreted in user's timezone)
          timezone: existingSettings?.timezone || userTimezone, // Keep existing or use new
          paused: false,
        } as never,
        {
          onConflict: 'user_id',
        }
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error ensuring user record:', error);
    return NextResponse.json(
      { error: 'Failed to create user record' },
      { status: 500 }
    );
  }
}

