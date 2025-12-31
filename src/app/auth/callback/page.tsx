'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleAuth = async () => {
      // Supabase automatically handles PKCE code exchange when getSession() is called
      // The code_verifier is stored in localStorage from when the magic link was requested
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        router.push(
          `/auth/auth-code-error?error=${encodeURIComponent(sessionError.message || 'authentication_failed')}`
        );
        return;
      }

      if (!session?.user) {
        router.push(
          '/auth/auth-code-error?error=session_not_found&details=Unable to create session. The magic link may be expired or invalid. Please request a new magic link.'
        );
        return;
      }

      // Ensure user record exists
      try {
        await fetch('/api/auth/ensure-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            userId: session.user.id,
            email: session.user.email,
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
  }, [router]);

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 text-sm">Completing authentication...</p>
      </div>
    </div>
  );
}
