import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  
  // Accept token_hash from either 'token_hash' or 'token' parameter
  const token_hash = searchParams.get('token_hash') || searchParams.get('token');
  
  // Get type from query string, default to 'magiclink' if missing
  let type = (searchParams.get('type') || 'magiclink').toLowerCase();
  
  // Allow 'email' as an alias for 'magiclink' (backward compatibility)
  if (type === 'email') {
    type = 'magiclink';
  }
  
  // Log the authentication attempt
  console.log('🔐 [Auth Confirm] Processing OTP verification:');
  console.log('  - token_hash present:', !!token_hash);
  console.log('  - token_hash length:', token_hash?.length || 0);
  console.log('  - type:', type);
  console.log('  - allowed types: magiclink, signup');

  if (!token_hash) {
    console.error('❌ [Auth Confirm] Missing token_hash parameter');
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?error=missing_token_hash&details=${encodeURIComponent('Missing token_hash in URL')}`
    );
  }

  // Validate type is one of the supported values
  if (type !== 'magiclink' && type !== 'signup') {
    console.warn(`⚠️ [Auth Confirm] Invalid type "${type}", defaulting to "magiclink"`);
    type = 'magiclink';
  }

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
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  console.log(`🔄 [Auth Confirm] Calling verifyOtp with type: ${type}`);
  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type: type as 'magiclink' | 'signup',
  });

  if (error) {
    console.error('❌ [Auth Confirm] verifyOtp error:', error.message);
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?error=${encodeURIComponent(error.message)}`
    );
  }

  console.log('✅ [Auth Confirm] OTP verified successfully, redirecting to callback');
  return NextResponse.redirect(`${origin}/auth/callback?success=true`);
}

