'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleAuth = async () => {
      // Check for error in query params
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (error) {
        console.error('Auth error:', error, errorDescription);
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

      // Check for code in query params
      const code = searchParams.get('code');
      const token = searchParams.get('token'); // Email OTP uses 'token' parameter
      const type = searchParams.get('type'); // 'email' for email OTP

      if (code || token) {
        try {
          let session = null;
          let user = null;

          // Try email OTP verification first (doesn't require PKCE)
          if (token && type === 'email') {
            const { data: verifyData, error: verifyError } =
              await supabase.auth.verifyOtp({
                token_hash: token,
                type: 'email',
              });

            if (verifyError) {
              console.error('OTP verification error:', verifyError);
              // Fall through to try code exchange
            } else if (verifyData?.user) {
              user = verifyData.user;
              session = verifyData.session;
            }
          }

          // If email OTP didn't work, try code exchange (for PKCE flow)
          if (!session && code) {
            try {
              const { data: exchangeData, error: exchangeError } =
                await supabase.auth.exchangeCodeForSession(code);

              if (exchangeError) {
                console.error('Code exchange error:', exchangeError);
                router.push(
                  `/auth/auth-code-error?error=${encodeURIComponent(exchangeError.message || 'authentication_failed')}`
                );
                return;
              }

              if (exchangeData?.user) {
                user = exchangeData.user;
                session = exchangeData.session;
              }
            } catch (exchangeErr) {
              console.error('Code exchange exception:', exchangeErr);
            }
          }

          // If still no session, try getSession() which might auto-exchange
          if (!session) {
            const {
              data: { session: existingSession },
              error: sessionError,
            } = await supabase.auth.getSession();

            if (sessionError) {
              console.error('Session error:', sessionError);
              router.push(
                `/auth/auth-code-error?error=${encodeURIComponent(sessionError.message || 'authentication_failed')}`
              );
              return;
            }

            if (existingSession?.user) {
              user = existingSession.user;
              session = existingSession;
            }
          }

          if (user && session) {
            console.log('User authenticated successfully:', user.id);

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
            console.log('No session found after all attempts');
            router.push('/auth/auth-code-error?error=session_not_found');
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing authentication...</p>
      </div>
    </div>
  );
}
