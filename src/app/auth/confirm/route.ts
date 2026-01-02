import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type'); // expect "email"

  if (!token_hash) {
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?error=missing_token_hash&details=${encodeURIComponent('Missing token_hash in URL')}`
    );
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

  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type: (type as 'email') || 'email',
  });

  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?error=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(`${origin}/auth/callback?success=true`);
}

