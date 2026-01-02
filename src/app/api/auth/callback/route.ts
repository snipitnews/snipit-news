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

      // For email OTP with token_hash parameter, redirect to /auth/confirm
      // Magic links now use token_hash and are handled by /auth/confirm route
      if (token) {
        console.log('🔐 Token parameter detected - redirecting to /auth/confirm');
        return NextResponse.redirect(
          `${origin}/auth/confirm?token_hash=${encodeURIComponent(token)}&type=${type || 'email'}`
        );
      }

      // For code parameter - this is a PKCE authorization code
      // PKCE codes require a code verifier stored in browser session storage
      // So we need to redirect to client-side callback to handle the exchange
      if (code) {
        console.log('🔐 Code parameter detected - redirecting to client-side callback for PKCE exchange');
        console.log('  Code length:', code.length);
        console.log('  Code preview:', code.substring(0, 50));
        console.log('  Note: PKCE code verifier is stored client-side, so exchange must happen there');
        
        // Redirect to client-side callback with the code
        // The client will use exchangeCodeForSession which has access to the code verifier
        return NextResponse.redirect(`${origin}/auth/callback?code=${encodeURIComponent(code)}`);
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
