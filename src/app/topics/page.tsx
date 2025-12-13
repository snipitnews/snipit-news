'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Plus, X, Check, ArrowRight, Crown } from 'lucide-react';

interface User {
  id: string;
  email: string;
  subscription_tier: 'free' | 'paid';
}

interface Topic {
  id: string;
  topic_name: string;
  created_at: string;
}

export default function TopicsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [newTopic, setNewTopic] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/');
        return;
      }

      // Load user data
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (userData) {
        setUser(userData);
      }

      // Load existing topics
      const { data: topicsData } = await supabase
        .from('user_topics')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true });

      if (topicsData) {
        setTopics(topicsData);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setError('Failed to load your data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const addTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic.trim() || !user) return;

    const maxTopics = user.subscription_tier === 'paid' ? 12 : 5;
    
    if (topics.length >= maxTopics) {
      setError(
        `Topic limit reached. ${user.subscription_tier === 'paid' ? 'Pro' : 'Free'} tier allows ${maxTopics} topics.`
      );
      return;
    }

    setIsAddingTopic(true);
    setError('');
    
    try {
      const { data, error: insertError } = await supabase
        .from('user_topics')
        .insert({
          user_id: user.id,
          topic_name: newTopic.trim(),
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.message.includes('Topic limit exceeded')) {
          setError(
            `Topic limit exceeded. ${user.subscription_tier === 'paid' ? 'Pro' : 'Free'} tier allows ${maxTopics} topics.`
          );
        } else if (insertError.message.includes('unique constraint')) {
          setError('This topic is already in your list.');
        } else {
          setError('Error adding topic: ' + insertError.message);
        }
        return;
      }

      setTopics([...topics, data]);
      setNewTopic('');
    } catch (error) {
      console.error('Error adding topic:', error);
      setError('Error adding topic. Please try again.');
    } finally {
      setIsAddingTopic(false);
    }
  };

  const removeTopic = async (topicId: string) => {
    try {
      const { error } = await supabase
        .from('user_topics')
        .delete()
        .eq('id', topicId);

      if (error) {
        setError('Error removing topic: ' + error.message);
        return;
      }

      setTopics(topics.filter((topic) => topic.id !== topicId));
    } catch (error) {
      console.error('Error removing topic:', error);
      setError('Error removing topic. Please try again.');
    }
  };

  const handleContinue = async () => {
    if (topics.length === 0) {
      setError('Please add at least one topic to continue.');
      return;
    }

    setIsSaving(true);
    // Small delay to show the saving state
    await new Promise((resolve) => setTimeout(resolve, 500));
    router.push('/dashboard');
  };

  const handleUpgrade = async () => {
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.id,
          email: user?.email,
        }),
      });

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setError('Error creating checkout session');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const maxTopics = user?.subscription_tier === 'paid' ? 12 : 5;
  const canAddMore = topics.length < maxTopics;
  const remainingTopics = maxTopics - topics.length;

  // Popular topic suggestions
  const popularTopics = [
    'artificial intelligence',
    'tech',
    'crypto',
    'sports',
    'politics',
    'business',
    'climate',
    'health',
    'science',
    'entertainment',
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-orange-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <span className="text-xl font-bold text-gray-900">SnipIt</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">{user?.email}</span>
              <span
                className={`px-2 py-1 text-xs font-medium rounded-full ${
                  user?.subscription_tier === 'paid'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {user?.subscription_tier === 'paid' ? 'Pro' : 'Free'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your Topics
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            Select the topics you want to stay informed about
          </p>
          <p className="text-sm text-gray-500">
            {user?.subscription_tier === 'paid' ? (
              <>Pro plan: Up to 12 topics</>
            ) : (
              <>Free plan: Up to 5 topics • <button onClick={handleUpgrade} className="text-orange-500 hover:text-orange-600 underline">Upgrade to Pro</button> for 12 topics</>
            )}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Add Topic Form */}
        {canAddMore && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Add a Topic
            </h2>
            <form onSubmit={addTopic} className="mb-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newTopic}
                  onChange={(e) => {
                    setNewTopic(e.target.value);
                    setError('');
                  }}
                  placeholder="e.g., artificial intelligence, tech, crypto, sports"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  disabled={isAddingTopic}
                />
                <button
                  type="submit"
                  disabled={isAddingTopic || !newTopic.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-orange-400 to-orange-500 text-white font-medium rounded-lg hover:from-orange-500 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <Plus className="w-5 h-5" />
                  <span>{isAddingTopic ? 'Adding...' : 'Add'}</span>
                </button>
              </div>
            </form>

            {/* Popular Topics Suggestions */}
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">Popular topics:</p>
              <div className="flex flex-wrap gap-2">
                {popularTopics
                  .filter((topic) => !topics.some((t) => t.topic_name.toLowerCase() === topic.toLowerCase()))
                  .slice(0, 8)
                  .map((topic) => (
                    <button
                      key={topic}
                      onClick={() => {
                        setNewTopic(topic);
                        setError('');
                      }}
                      className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors"
                    >
                      {topic}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Selected Topics */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Your Topics ({topics.length} / {maxTopics})
            </h2>
            {!canAddMore && user?.subscription_tier === 'free' && (
              <button
                onClick={handleUpgrade}
                className="text-sm text-orange-500 hover:text-orange-600 font-medium flex items-center space-x-1"
              >
                <Crown className="w-4 h-4" />
                <span>Upgrade to Pro</span>
              </button>
            )}
          </div>

          {topics.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📝</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No topics yet
              </h3>
              <p className="text-gray-600">
                Add your first topic above to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {topics.map((topic) => (
                <div
                  key={topic.id}
                  className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg border border-orange-100 hover:border-orange-200 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-orange-500" />
                    <span className="font-medium text-gray-900">
                      {topic.topic_name}
                    </span>
                  </div>
                  <button
                    onClick={() => removeTopic(topic.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    title="Remove topic"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {canAddMore && topics.length > 0 && (
            <p className="mt-4 text-sm text-gray-500 text-center">
              You can add {remainingTopics} more topic{remainingTopics !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Continue Button */}
        <div className="flex justify-center">
          <button
            onClick={handleContinue}
            disabled={isSaving || topics.length === 0}
            className="px-8 py-4 bg-gradient-to-r from-orange-400 to-orange-500 text-white font-semibold rounded-lg hover:from-orange-500 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-2 text-lg"
          >
            <span>{isSaving ? 'Saving...' : 'Continue to Dashboard'}</span>
            {!isSaving && <ArrowRight className="w-5 h-5" />}
          </button>
        </div>

        {/* Upgrade CTA for Free Users */}
        {user?.subscription_tier === 'free' && topics.length >= 3 && (
          <div className="mt-8 p-6 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg border border-orange-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Crown className="w-6 h-6 text-yellow-500" />
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Want More Topics?
                  </h3>
                  <p className="text-sm text-gray-600">
                    Upgrade to Pro for 12 topics and better summaries
                  </p>
                </div>
              </div>
              <button
                onClick={handleUpgrade}
                className="px-4 py-2 bg-gradient-to-r from-orange-400 to-orange-500 text-white font-medium rounded-lg hover:from-orange-500 hover:to-orange-600 transition-all"
              >
                Upgrade Now
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

