import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const next = searchParams.get('next') ?? '/dashboard';

  // Handle error cases from Supabase
  if (error) {
    console.error('Auth error from Supabase:', error, errorDescription);
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || '')}`
    );
  }

  // Handle successful authentication
  if (code) {
    const response = NextResponse.redirect(new URL(next, origin));
    
    try {
      // Create a server client with cookie handling
      // Read cookies from the request (not from cookies() helper)
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return request.cookies.get(name)?.value;
            },
            set(name: string, value: string, options: any) {
              request.cookies.set({
                name,
                value,
                ...options,
              });
              response.cookies.set({
                name,
                value,
                ...options,
              });
            },
            remove(name: string, options: any) {
              request.cookies.set({
                name,
                value: '',
                ...options,
              });
              response.cookies.set({
                name,
                value: '',
                ...options,
              });
            },
          },
        }
      );

      // For email OTP, exchange code for session
      // Note: Email OTP doesn't use PKCE, so we exchange directly
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        console.error('Auth exchange error:', exchangeError);
        // If PKCE error, try without code verifier (for email OTP)
        if (exchangeError.message.includes('code verifier')) {
          console.log('PKCE error detected, trying alternative method...');
          // For email OTP, we might need to use a different approach
          // Let's redirect to client-side callback which can handle it
          return NextResponse.redirect(
            `${origin}/auth/callback?code=${code}`
          );
        }
        return NextResponse.redirect(
          `${origin}/auth/auth-code-error?error=${encodeURIComponent(exchangeError.message || 'authentication_failed')}`
        );
      }

      if (data?.user) {
        console.log('User authenticated successfully:', data.user.id);
        
        // Ensure user record exists (backup in case trigger fails)
        try {
          await getSupabaseAdmin()
            .from('users')
            .upsert(
              {
                id: data.user.id,
                email: data.user.email || '',
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
                user_id: data.user.id,
                delivery_time: '08:00:00-05:00',
                timezone: 'America/New_York',
                paused: false,
              },
              {
                onConflict: 'user_id',
              }
            );
        } catch (userError) {
          console.error('Error ensuring user record exists:', userError);
          // Continue anyway - user can still access the app
        }
        
        return response;
      }
    } catch (error) {
      console.error('Unexpected error during auth:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.redirect(
        `${origin}/auth/auth-code-error?error=${encodeURIComponent(errorMessage)}`
      );
    }
  }

  // No code and no error - invalid request
  return NextResponse.redirect(
    `${origin}/auth/auth-code-error?error=${encodeURIComponent('missing_code')}`
  );
}
