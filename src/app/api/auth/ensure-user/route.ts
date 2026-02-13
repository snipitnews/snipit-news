import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// Map browser timezone to nearest US timezone group
const US_TIMEZONE_MAP: Record<string, string> = {
  'America/New_York': 'America/New_York',
  'America/Detroit': 'America/New_York',
  'America/Indiana/Indianapolis': 'America/New_York',
  'America/Indiana/Knox': 'America/Chicago',
  'America/Indiana/Marengo': 'America/New_York',
  'America/Indiana/Petersburg': 'America/New_York',
  'America/Indiana/Tell_City': 'America/Chicago',
  'America/Indiana/Vevay': 'America/New_York',
  'America/Indiana/Vincennes': 'America/New_York',
  'America/Indiana/Winamac': 'America/New_York',
  'America/Kentucky/Louisville': 'America/New_York',
  'America/Kentucky/Monticello': 'America/New_York',
  'America/Chicago': 'America/Chicago',
  'America/Menominee': 'America/Chicago',
  'America/North_Dakota/Beulah': 'America/Chicago',
  'America/North_Dakota/Center': 'America/Chicago',
  'America/North_Dakota/New_Salem': 'America/Chicago',
  'America/Denver': 'America/Denver',
  'America/Boise': 'America/Denver',
  'America/Phoenix': 'America/Denver',
  'America/Los_Angeles': 'America/Los_Angeles',
  'America/Anchorage': 'America/Los_Angeles',
  'Pacific/Honolulu': 'America/Los_Angeles',
};

// UTC offsets for delivery_time (standard time)
const TIMEZONE_OFFSETS: Record<string, string> = {
  'America/New_York': '-05:00',
  'America/Chicago': '-06:00',
  'America/Denver': '-07:00',
  'America/Los_Angeles': '-08:00',
};

function mapToUSTimezone(browserTimezone: string | undefined): string {
  if (!browserTimezone) return 'America/New_York';

  // Direct match
  if (US_TIMEZONE_MAP[browserTimezone]) {
    return US_TIMEZONE_MAP[browserTimezone];
  }

  // Try to match by US prefix
  if (browserTimezone.startsWith('America/')) {
    // Attempt offset-based matching: get the current UTC offset of the browser timezone
    // and map to the closest US timezone
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: browserTimezone,
        timeZoneName: 'shortOffset',
      });
      const parts = formatter.formatToParts(now);
      const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value || '';
      // offsetPart looks like "GMT-5" or "GMT-8"
      const offsetMatch = offsetPart.match(/GMT([+-]\d+)/);
      if (offsetMatch) {
        const offset = parseInt(offsetMatch[1]);
        if (offset >= -4) return 'America/New_York';    // EDT/EST
        if (offset === -5) return 'America/New_York';   // EST
        if (offset === -6) return 'America/Chicago';    // CST
        if (offset === -7) return 'America/Denver';     // MST
        if (offset <= -8) return 'America/Los_Angeles'; // PST
      }
    } catch {
      // Fall through to default
    }
  }

  // Non-US or unrecognized timezone defaults to Eastern
  return 'America/New_York';
}

export async function POST(request: NextRequest) {
  try {
    const { userId, email, timezone } = await request.json();

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
        } as never,
        {
          onConflict: 'id',
        }
      );

    // Check if email settings already exist (don't overwrite timezone on re-login)
    const supabase = getSupabaseAdmin();
    const { data: existingSettings } = await supabase
      .from('user_email_settings')
      .select('user_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    const mappedTimezone = mapToUSTimezone(timezone);

    if (!existingSettings) {
      // First-time signup: create email settings with detected timezone
      const utcOffset = TIMEZONE_OFFSETS[mappedTimezone] || '-05:00';
      const deliveryTime = `06:45:00${utcOffset}`;

      await supabase
        .from('user_email_settings')
        .insert(
          {
            user_id: userId,
            delivery_time: deliveryTime,
            timezone: mappedTimezone,
            paused: false,
          } as never
        );
    }
    // Existing users keep their current timezone and delivery_time

    return NextResponse.json({ success: true, timezone: mappedTimezone });
  } catch (error) {
    console.error('Error ensuring user record:', error);
    return NextResponse.json(
      { error: 'Failed to create user record' },
      { status: 500 }
    );
  }
}
