import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { userId, email } = await request.json();

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'User ID and email are required' },
        { status: 400 }
      );
    }

    // Ensure user record exists
    await getSupabaseAdmin()
      .from('users')
      .upsert(
        {
          id: userId,
          email: email,
          subscription_tier: 'free',
        },
        {
          onConflict: 'id',
        }
      );

    // Ensure email settings exist
    await getSupabaseAdmin()
      .from('user_email_settings')
      .upsert(
        {
          user_id: userId,
          delivery_time: '08:00:00-05:00',
          timezone: 'America/New_York',
          paused: false,
        },
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

