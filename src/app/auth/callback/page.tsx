'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleAuth = async () => {
      // This callback only handles OTP flows (magiclink/signup) that come from /auth/confirm
      // The server-side /auth/confirm route handles verifyOtp and redirects here with success=true
      // We do NOT handle PKCE code exchange here - that's handled elsewhere
      
      // Check if server-side verification was successful
      const success = searchParams.get('success');

      if (success !== 'true') {
        console.error('❌ [Auth Callback] No success parameter found - invalid OTP flow');
        router.push(
          '/auth/auth-code-error?error=missing_success_param&details=Authentication callback is missing required parameters.'
        );
        return;
      }

      console.log('✅ [Auth Callback] Server-side OTP verification successful, waiting for session...');
      // Give the server a moment to set cookies, then try to get session
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Retry a few times if session isn't immediately available
      let session = null;
      let sessionError = null;
      let retries = 0;
      const maxRetries = 3;

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
        console.error('❌ No session found');
        router.push(
          '/auth/auth-code-error?error=session_not_found&details=Unable to create session. The magic link may be expired or invalid. Please request a new magic link.'
        );
        return;
      }

            // Ensure user record exists with auto-detected timezone
            try {
              const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
              await fetch('/api/auth/ensure-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  userId: session.user.id,
                  email: session.user.email,
                  timezone: browserTimezone,
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

      // Broadcast auth success to other tabs (e.g., the original login tab)
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const channel = new BroadcastChannel('snipit-auth');
          channel.postMessage({ type: 'AUTH_SUCCESS', userId: session.user.id });
          channel.close();
        }
        // Also use localStorage as fallback for browsers without BroadcastChannel
        localStorage.setItem('snipit-auth-success', Date.now().toString());
      } catch (broadcastError) {
        console.warn('Could not broadcast auth success:', broadcastError);
      }

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
