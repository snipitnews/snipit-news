'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function UnsubscribePageContent() {
  const [email, setEmail] = useState('');
  const [isUnsubscribing, setIsUnsubscribing] = useState(false);
  const [message, setMessage] = useState('');
  const searchParams = useSearchParams();

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  const handleUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsUnsubscribing(true);
    setMessage('');

    try {
      // Find user by email
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (userError || !user) {
        setMessage('Email not found. You may already be unsubscribed.');
        return;
      }

      // Remove all topics for this user and pause email delivery
      const { error: topicsError } = await supabase
        .from('user_topics')
        .delete()
        .eq('user_id', user.id);

      if (topicsError) {
        setMessage('Error unsubscribing. Please try again.');
        console.error('Error deleting topics:', topicsError);
        return;
      }

      // Pause email delivery if settings exist
      const { error: settingsError } = await supabase
        .from('user_email_settings')
        .upsert(
          {
            user_id: user.id,
            paused: true,
          },
          {
            onConflict: 'user_id',
          }
        );

      if (settingsError) {
        console.error('Error updating email settings for unsubscribe:', settingsError);
        // Don't fail unsubscribe if pausing fails; topics are already removed
      }

      setMessage(
        'Successfully unsubscribed! You will no longer receive daily digests.'
      );
    } catch (error) {
      setMessage('Something went wrong. Please try again.');
      console.error('Error unsubscribing:', error);
    } finally {
      setIsUnsubscribing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📧</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Unsubscribe</h1>
          <p className="text-gray-600">
            We're sorry to see you go! Enter your email to unsubscribe from
            daily digests.
          </p>
        </div>

        <form onSubmit={handleUnsubscribe} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="your@email.com"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isUnsubscribing || !email}
            className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isUnsubscribing ? 'Unsubscribing...' : 'Unsubscribe'}
          </button>
        </form>

        {message && (
          <div
            className={`mt-4 p-3 rounded-lg text-sm ${
              message.includes('Successfully')
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {message}
          </div>
        )}

        <div className="mt-6 text-center">
          <a href="/" className="text-blue-600 hover:text-blue-700 text-sm">
            Back to SnipIt
          </a>
        </div>
      </div>
    </div>
  );
}

function UnsubscribePageFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm">Loading...</p>
        </div>
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<UnsubscribePageFallback />}>
      <UnsubscribePageContent />
    </Suspense>
  );
}
