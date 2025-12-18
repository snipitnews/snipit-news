import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const token = searchParams.get('token');
  const type = searchParams.get('type');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const next = searchParams.get('next') ?? '/dashboard';

  // Debug logging
  console.log('🔍 API Auth Callback - Request received:');
  console.log('  URL:', request.url);
  console.log('  Code:', code ? `${code.substring(0, 20)}...` : 'none');
  console.log('  Token:', token ? `${token.substring(0, 20)}...` : 'none');
  console.log('  Type:', type || 'none');
  console.log('  Error:', error || 'none');
  console.log('  All params:', Object.fromEntries(searchParams.entries()));

  // Handle error cases from Supabase
  if (error) {
    console.error('❌ Auth error from Supabase:', error, errorDescription);
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || '')}`
    );
  }

  // Handle successful authentication
  if (code || token) {
    try {
      // Create Supabase client for server-side operations
      const cookieStore = await cookies();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options)
                );
              } catch {
                // The `setAll` method was called from a Server Component.
                // This can be ignored if you have middleware refreshing
                // user sessions.
              }
            },
          },
        }
      );

      // For email OTP with token parameter, verify on server side
      if (token) {
        console.log('🔐 Token parameter detected - attempting server-side OTP verification');
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: (type as 'email' | 'magiclink') || 'magiclink',
        });

        if (verifyError) {
          console.error('❌ OTP verification failed:', verifyError);
          return NextResponse.redirect(
            `${origin}/auth/auth-code-error?error=${encodeURIComponent(verifyError.message || 'otp_verification_failed')}`
          );
        }

        if (data?.user && data?.session) {
          console.log('✅ OTP verification successful on server side');
          // Redirect to client-side callback to complete the flow
          return NextResponse.redirect(`${origin}/auth/callback?success=true`);
        }
      }

      // For code parameter - try server-side exchange first (for PKCE flows)
      // If that fails, redirect to client-side for OTP verification
      if (code) {
        console.log('🔐 Code parameter detected - attempting server-side exchange');
        console.log('  Code length:', code.length);
        console.log('  Code preview:', code.substring(0, 50));

        // Try exchangeCodeForSession first (for PKCE/OAuth flows)
        const { data: exchangeData, error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (!exchangeError && exchangeData?.user && exchangeData?.session) {
          console.log('✅ Code exchange successful on server side (PKCE/OAuth flow)');
          // Redirect to client-side callback to complete the flow
          return NextResponse.redirect(`${origin}/auth/callback?success=true`);
        }

        // If exchangeCodeForSession fails, this is likely an email OTP code
        // Redirect to client-side callback for OTP verification
        if (exchangeError) {
          console.log('⚠️ Code exchange failed (likely email OTP):', exchangeError.message);
          console.log('  Redirecting to client-side callback for OTP verification');
          return NextResponse.redirect(
            `${origin}/auth/callback?code=${encodeURIComponent(code)}${type ? `&type=${encodeURIComponent(type)}` : ''}`
          );
        }
      }
    } catch (error) {
      console.error('❌ Unexpected error during auth processing:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error('  Stack:', errorStack);
      return NextResponse.redirect(
        `${origin}/auth/auth-code-error?error=${encodeURIComponent(errorMessage)}`
      );
    }
  }

  // No code and no error - invalid request
  console.warn('⚠️ No code or token found in request');
  return NextResponse.redirect(
    `${origin}/auth/auth-code-error?error=${encodeURIComponent('missing_code')}`
  );
}
