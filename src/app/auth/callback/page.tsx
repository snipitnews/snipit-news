'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleAuth = async () => {
      // Debug logging
      console.log('🔍 Client Auth Callback - Starting authentication flow');
      console.log('  Current URL:', window.location.href);
      console.log('  Search params:', Object.fromEntries(new URLSearchParams(window.location.search).entries()));
      console.log('  Hash:', window.location.hash);

      // Check for error in query params
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (error) {
        console.error('❌ Auth error in query params:', error, errorDescription);
        router.push(
          `/auth/auth-code-error?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || '')}`
        );
        return;
      }

      // Check for hash fragment tokens (implicit flow)
      if (typeof window !== 'undefined') {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const error = params.get('error');
        const errorDescription = params.get('error_description');

        if (error) {
          console.error('Auth error from hash:', error, errorDescription);
          router.push(
            `/auth/auth-code-error?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || '')}`
          );
          return;
        }

        if (accessToken && refreshToken) {
          try {
            // Set the session using the tokens from the hash
            const { data, error: sessionError } =
              await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });

            if (sessionError) {
              console.error('Error setting session:', sessionError);
              router.push(
                `/auth/auth-code-error?error=${encodeURIComponent(sessionError.message || 'session_error')}`
              );
              return;
            }

            if (data?.user) {
              console.log('User authenticated successfully:', data.user.id);

              // Ensure user record exists
              try {
                await fetch('/api/auth/ensure-user', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    userId: data.user.id,
                    email: data.user.email,
                  }),
                });
              } catch (userError) {
                console.error('Error ensuring user record:', userError);
                // Continue anyway
              }

              // Clear the hash and redirect to topics selection
              window.history.replaceState(null, '', window.location.pathname);

              // Check if user already has topics
              const {
                data: { session },
              } = await supabase.auth.getSession();
              if (session) {
                const { data: existingTopics } = await supabase
                  .from('user_topics')
                  .select('id')
                  .eq('user_id', data.user.id);

                if (existingTopics && existingTopics.length > 0) {
                  router.push('/dashboard');
                } else {
                  router.push('/topics');
                }
              } else {
                router.push('/topics');
              }
              return;
            }
          } catch (error) {
            console.error('Unexpected error:', error);
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            router.push(
              `/auth/auth-code-error?error=${encodeURIComponent(errorMessage)}`
            );
            return;
          }
        }
      }

      // Check if server-side auth was successful
      const success = searchParams.get('success');
      if (success === 'true') {
        console.log('✅ Server-side authentication successful, checking session...');
        // Wait a moment for cookies to be set
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const {
          data: { session: existingSession },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !existingSession?.user) {
          console.error('❌ Session not found after server-side auth:', sessionError);
          router.push(
            `/auth/auth-code-error?error=${encodeURIComponent('session_not_found')}`
          );
          return;
        }

        console.log('✅ Session found, redirecting to dashboard/topics');
        // Check if user already has topics
        const { data: existingTopics } = await supabase
          .from('user_topics')
          .select('id')
          .eq('user_id', existingSession.user.id);

        if (existingTopics && existingTopics.length > 0) {
          router.push('/dashboard');
        } else {
          router.push('/topics');
        }
        return;
      }

      // Check for code or token in query params
      const code = searchParams.get('code');
      const token = searchParams.get('token');
      const type = searchParams.get('type');

      console.log('🔍 Checking for code/token:');
      console.log('  Code:', code ? `${code.substring(0, 20)}... (length: ${code.length})` : 'none');
      console.log('  Token:', token ? `${token.substring(0, 20)}... (length: ${token.length})` : 'none');
      console.log('  Type:', type || 'none');

      if (code || token) {
        try {
          let session = null;
          let user = null;

          // Handle email OTP flow (uses token parameter)
          if (token) {
            console.log('🔐 Attempting OTP verification with token...');
            console.log('  Token type:', type === 'email' ? 'email' : 'magiclink');
            
            const { data: verifyData, error: verifyError } =
              await supabase.auth.verifyOtp({
                token_hash: token,
                type: type === 'email' ? 'email' : 'magiclink',
              });

            if (verifyError) {
              console.error('❌ OTP verification error:', verifyError);
              console.error('  Error message:', verifyError.message);
              console.error('  Error status:', verifyError.status);
              router.push(
                `/auth/auth-code-error?error=${encodeURIComponent(verifyError.message || 'authentication_failed')}`
              );
              return;
            }

            if (verifyData?.user && verifyData?.session) {
              console.log('✅ OTP verification successful!');
              console.log('  User ID:', verifyData.user.id);
              user = verifyData.user;
              session = verifyData.session;
            } else {
              console.warn('⚠️ OTP verification returned no user/session');
            }
          }

          // Handle code parameter - for email OTP magic links
          // Note: Email OTP codes from signInWithOtp should be verified with verifyOtp, not exchangeCodeForSession
          if (!session && code) {
            console.log('🔐 Attempting OTP verification with code...');
            console.log('  Code length:', code.length);
            console.log('  Code preview:', code.substring(0, 50));
            
            try {
              // Try different OTP types for email magic links
              const otpTypes: Array<'email' | 'magiclink'> = ['email', 'magiclink'];
              let verified = false;

              for (const otpType of otpTypes) {
                console.log(`  Trying OTP verification as type: ${otpType}`);
                
                // Try with token_hash first (most common)
                let verifyData, verifyError;
                try {
                  const result = await supabase.auth.verifyOtp({
                    token_hash: code,
                    type: otpType,
                  });
                  verifyData = result.data;
                  verifyError = result.error;
                } catch (err) {
                  console.log(`  Exception with token_hash for ${otpType}:`, err);
                  verifyError = err as Error;
                }

                if (verifyError) {
                  console.log(`  ❌ OTP verification with token_hash failed for ${otpType}:`, verifyError.message);
                  console.log(`  Full error object:`, {
                    message: verifyError.message,
                    status: verifyError.status,
                    name: verifyError.name,
                    code: (verifyError as any).code,
                  });
                  
                  // Try with token parameter instead (some Supabase versions use this)
                  console.log(`  Trying with 'token' parameter instead...`);
                  try {
                    const result2 = await supabase.auth.verifyOtp({
                      token: code,
                      type: otpType,
                    } as any);
                    
                    if (!result2.error && result2.data?.user && result2.data?.session) {
                      console.log(`  ✅ Successfully verified OTP as ${otpType} using 'token' parameter!`);
                      user = result2.data.user;
                      session = result2.data.session;
                      verified = true;
                      break;
                    } else if (result2.error) {
                      console.log(`  ❌ OTP verification with 'token' also failed:`, result2.error.message);
                      console.log(`  Full error:`, result2.error);
                    }
                  } catch (err2) {
                    console.log(`  Exception with 'token' parameter:`, err2);
                  }
                  
                  // Try with email parameter (some flows require email + code)
                  console.log(`  Trying with email + code combination...`);
                  try {
                    // Get email from URL if available, or try without
                    const emailParam = searchParams.get('email');
                    if (emailParam) {
                      const result3 = await supabase.auth.verifyOtp({
                        email: emailParam,
                        token: code,
                        type: otpType,
                      } as any);
                      
                      if (!result3.error && result3.data?.user && result3.data?.session) {
                        console.log(`  ✅ Successfully verified OTP with email + code!`);
                        user = result3.data.user;
                        session = result3.data.session;
                        verified = true;
                        break;
                      } else if (result3.error) {
                        console.log(`  ❌ OTP verification with email + code failed:`, result3.error.message);
                      }
                    }
                  } catch (err3) {
                    console.log(`  Exception with email + code:`, err3);
                  }
                } else if (verifyData?.user && verifyData?.session) {
                  console.log(`  ✅ Successfully verified OTP as ${otpType} using token_hash!`);
                  console.log('  User ID:', verifyData.user.id);
                  user = verifyData.user;
                  session = verifyData.session;
                  verified = true;
                  break;
                } else {
                  console.log(`  ⚠️ OTP verification for ${otpType} returned no user/session`);
                }
              }

              if (!verified) {
                // If OTP verification fails, this might be a PKCE code (from OAuth, not email)
                // Only try exchangeCodeForSession as a last resort for non-email flows
                console.log('⚠️ All OTP verification attempts failed');
                console.log('  Attempting PKCE exchange as last resort (this will likely fail for email OTP)...');
                try {
                  const { data: exchangeData, error: exchangeError } =
                    await supabase.auth.exchangeCodeForSession(code);

                  if (exchangeError) {
                    console.error('❌ PKCE exchange failed (expected for email OTP):', exchangeError);
                    console.error('  Error message:', exchangeError.message);
                    console.error('  Error status:', exchangeError.status);
                    console.error('  This error is expected for email OTP codes - they should use verifyOtp, not exchangeCodeForSession');
                    
                    // Provide more helpful error message
                    const errorMsg = exchangeError.message.includes('code verifier') || 
                                   exchangeError.message.includes('non-empty')
                      ? 'Email magic link authentication failed. Please request a new magic link.'
                      : exchangeError.message;
                    
                    router.push(
                      `/auth/auth-code-error?error=${encodeURIComponent(errorMsg)}&details=${encodeURIComponent('Email OTP codes require verifyOtp, not exchangeCodeForSession')}`
                    );
                    return;
                  }

                  if (exchangeData?.user) {
                    console.log('✅ PKCE exchange successful (unexpected for email OTP)');
                    user = exchangeData.user;
                    session = exchangeData.session;
                  }
                } catch (exchangeErr) {
                  console.error('❌ PKCE exchange exception:', exchangeErr);
                  const errMsg = exchangeErr instanceof Error ? exchangeErr.message : 'Unknown error';
                  router.push(
                    `/auth/auth-code-error?error=${encodeURIComponent('Authentication failed: ' + errMsg)}`
                  );
                  return;
                }
              }
            } catch (err) {
              console.error('❌ OTP verification exception:', err);
              const errMsg = err instanceof Error ? err.message : 'Unknown error';
              const errStack = err instanceof Error ? err.stack : undefined;
              console.error('  Stack:', errStack);
              router.push(
                `/auth/auth-code-error?error=${encodeURIComponent('Authentication failed: ' + errMsg)}`
              );
              return;
            }
          }

          // If still no session, try getSession() which might auto-exchange
          if (!session) {
            console.log('⚠️ No session after OTP/PKCE attempts, trying getSession()...');
            const {
              data: { session: existingSession },
              error: sessionError,
            } = await supabase.auth.getSession();

            if (sessionError) {
              console.error('❌ Session error:', sessionError);
              router.push(
                `/auth/auth-code-error?error=${encodeURIComponent(sessionError.message || 'authentication_failed')}`
              );
              return;
            }

            if (existingSession?.user) {
              console.log('✅ Found existing session via getSession()');
              user = existingSession.user;
              session = existingSession;
            } else {
              console.warn('⚠️ getSession() returned no session');
            }
          }

          if (user && session) {
            console.log('✅ User authenticated successfully!');
            console.log('  User ID:', user.id);
            console.log('  User email:', user.email);

            // Ensure user record exists
            try {
              await fetch('/api/auth/ensure-user', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                  userId: user.id,
                  email: user.email,
                }),
              });
            } catch (userError) {
              console.error('Error ensuring user record:', userError);
              // Continue anyway
            }

            // Check if user already has topics
            const { data: existingTopics } = await supabase
              .from('user_topics')
              .select('id')
              .eq('user_id', user.id);

            if (existingTopics && existingTopics.length > 0) {
              router.push('/dashboard');
            } else {
              router.push('/topics');
            }
            return;
          } else {
            console.error('❌ No session found after all authentication attempts');
            console.error('  Attempted methods:');
            console.error('    - Token OTP verification:', token ? 'tried' : 'skipped (no token)');
            console.error('    - Code OTP verification:', code ? 'tried' : 'skipped (no code)');
            console.error('    - PKCE exchange:', code && !session ? 'tried' : 'skipped');
            console.error('    - getSession():', 'tried');
            router.push('/auth/auth-code-error?error=session_not_found&details=All authentication methods failed');
            return;
          }
        } catch (error) {
          console.error('Unexpected error:', error);
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          router.push(
            `/auth/auth-code-error?error=${encodeURIComponent(errorMessage)}`
          );
          return;
        }
      }

      // No code or token found
      router.push('/auth/auth-code-error?error=missing_code');
    };

    handleAuth();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 text-sm">Completing authentication...</p>
      </div>
    </div>
  );
}
