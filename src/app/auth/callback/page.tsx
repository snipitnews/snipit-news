'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleAuth = async () => {
      // Check if we have a code in the URL (from magic link)
      const code = searchParams.get('code');
      const success = searchParams.get('success');

      // If we have a code, try to exchange it for a session
      if (code) {
        console.log('🔐 Code found in URL, attempting to exchange for session...');
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        
        if (error) {
          console.error('❌ Failed to exchange code for session:', error);
          router.push(
            `/auth/auth-code-error?error=${encodeURIComponent(error.message || 'authentication_failed')}`
          );
          return;
        }

        if (data?.session) {
          console.log('✅ Successfully exchanged code for session');
          // Continue with session handling below
        } else {
          console.error('❌ No session returned from code exchange');
          router.push(
            '/auth/auth-code-error?error=session_not_found&details=Unable to create session. The magic link may be expired or invalid. Please request a new magic link.'
          );
          return;
        }
      }

      // If success=true, the server already verified the OTP, just wait for session
      if (success === 'true') {
        console.log('✅ Server-side verification successful, waiting for session...');
        // Give the server a moment to set cookies, then try to get session
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Get the session (either from code exchange above or from cookies)
      // Retry a few times if session isn't immediately available (for server-side verification)
      let session = null;
      let sessionError = null;
      let retries = 0;
      const maxRetries = success === 'true' ? 3 : 0; // Only retry if server already verified

      while (retries <= maxRetries) {
        const result = await supabase.auth.getSession();
        session = result.data?.session;
        sessionError = result.error;

        if (session?.user) {
          break; // Session found, exit retry loop
        }

        if (retries < maxRetries) {
          console.log(`⏳ Session not found, retrying... (${retries + 1}/${maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, 500));
          retries++;
        } else {
          break; // Max retries reached
        }
      }

      if (sessionError) {
        console.error('❌ Error getting session:', sessionError);
        router.push(
          `/auth/auth-code-error?error=${encodeURIComponent(sessionError.message || 'authentication_failed')}`
        );
        return;
      }

      if (!session?.user) {
        console.error('❌ No session found after retries');
        router.push(
          '/auth/auth-code-error?error=session_not_found&details=Unable to create session. The magic link may be expired or invalid. Please request a new magic link.'
        );
        return;
      }

            // Ensure user record exists with timezone detection
            try {
              // Detect user's timezone from browser
              const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
              
              await fetch('/api/auth/ensure-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  userId: session.user.id,
                  email: session.user.email,
                  timezone: userTimezone,
                }),
              });
            } catch (userError) {
              console.error('Error ensuring user record:', userError);
            }

      // Check if user already has topics
      const { data: existingTopics } = await supabase
        .from('user_topics')
        .select('id')
        .eq('user_id', session.user.id);

      router.push(existingTopics && existingTopics.length > 0 ? '/' : '/topics');
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

export default function AuthCallback() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 text-sm">Loading...</p>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
