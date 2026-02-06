'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Plus, X, Crown, Clock, Pause, Play, Mail, Check } from 'lucide-react';
import Navigation from '@/components/Navigation';
import TopicSelector from '@/components/TopicSelector';

interface User {
  id: string;
  email: string;
  subscription_tier: 'free' | 'paid';
  role?: 'user' | 'admin';
}

interface Topic {
  id: string;
  topic_name: string;
  created_at: string;
}

interface EmailSettings {
  id: string;
  user_id: string;
  delivery_time: string;
  timezone: string;
  paused: boolean;
}

interface EmailArchive {
  id: string;
  sent_at: string;
  subject: string;
  topics: string[];
  content: unknown;
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingTopic, setIsAddingTopic] = useState<string | null>(null);
  const [emailSettings, setEmailSettings] = useState<EmailSettings | null>(
    null
  );
  const [isPaused, setIsPaused] = useState(false);
  const [archive, setArchive] = useState<EmailArchive[]>([]);
  const [activeTab, setActiveTab] = useState<'topics' | 'settings' | 'archive'>(
    'topics'
  );

  useEffect(() => {
    loadUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUserData = async () => {
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Session error:', sessionError);
      }

      if (!session) {
        console.log('No session found, redirecting to home');
        router.push('/');
        return;
      }

      console.log(
        'Session found, loading dashboard data for user:',
        session.user.id
      );

      // Load user data
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (userData) {
        setUser(userData);
      }

      // Load topics
      const { data: topicsData } = await supabase
        .from('user_topics')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true });

      if (topicsData) {
        setTopics(topicsData);
      }

      // Load email settings
      const settingsResponse = await fetch('/api/email-settings', {
        credentials: 'include',
      });
      if (settingsResponse.ok) {
        const { settings } = await settingsResponse.json();
        if (settings) {
          setEmailSettings(settings);
          setIsPaused(settings.paused || false);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadArchive = async () => {
    try {
      const response = await fetch('/api/archive?limit=20', {
        credentials: 'include',
      });
      if (response.ok) {
        const { archive: archiveData } = await response.json();
        setArchive(archiveData || []);
      }
    } catch (error) {
      console.error('Error loading archive:', error);
    }
  };

  const addTopic = async (subtopic: string) => {
    if (!user) return;

    const maxTopics = user.subscription_tier === 'paid' ? 12 : 3;
    
    if (topics.length >= maxTopics) {
      alert(
        `Topic limit reached. ${user.subscription_tier === 'paid' ? 'Pro' : 'Free'} tier allows ${maxTopics} topics.`
      );
      return;
    }

    // Check if already selected
    if (topics.some((t) => t.topic_name.toLowerCase() === subtopic.toLowerCase())) {
      alert('This topic is already in your list.');
      return;
    }

    setIsAddingTopic(subtopic);
    try {
      const { data, error } = await supabase
        .from('user_topics')
        .insert({
          user_id: user.id,
          topic_name: subtopic.trim(),
        })
        .select()
        .single();

      if (error) {
        if (error.message.includes('Topic limit exceeded')) {
          alert(
            `Topic limit exceeded. ${user.subscription_tier === 'paid' ? 'Pro' : 'Free'} tier allows ${maxTopics} topics.`
          );
        } else if (error.message.includes('unique constraint')) {
          alert('This topic is already in your list.');
        } else {
          alert('Error adding topic: ' + error.message);
        }
        return;
      }

      setTopics([...topics, data]);
    } catch (error) {
      console.error('Error adding topic:', error);
      alert('Error adding topic');
    } finally {
      setIsAddingTopic(null);
    }
  };

  const removeTopic = async (topicId: string) => {
    if (!confirm('Are you sure you want to remove this topic?')) return;

    try {
      const { error } = await supabase
        .from('user_topics')
        .delete()
        .eq('id', topicId);

      if (error) {
        alert('Error removing topic: ' + error.message);
        return;
      }

      setTopics(topics.filter((topic) => topic.id !== topicId));
    } catch (error) {
      console.error('Error removing topic:', error);
      alert('Error removing topic');
    }
  };

  const updateEmailSettings = async () => {
    try {
      const response = await fetch('/api/email-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          // Delivery time is fixed globally to 6:30 AM EST
          paused: isPaused,
        }),
      });

      if (response.ok) {
        const { settings } = await response.json();
        setEmailSettings(settings);
        alert('Settings updated successfully!');
      } else {
        const { error } = await response.json();
        alert('Error updating settings: ' + error);
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      alert('Error updating settings');
    }
  };

  const togglePause = async () => {
    const newPausedState = !isPaused;
    setIsPaused(newPausedState);

    try {
      const response = await fetch('/api/email-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          // Delivery time is fixed globally to 6:30 AM EST
          paused: newPausedState,
        }),
      });

      if (response.ok) {
        const { settings } = await response.json();
        setEmailSettings(settings);
      } else {
        setIsPaused(!newPausedState); // Revert on error
        alert('Error updating pause status');
      }
    } catch (error) {
      setIsPaused(!newPausedState); // Revert on error
      console.error('Error toggling pause:', error);
      alert('Error updating pause status');
    }
  };

  const handleUpgrade = async () => {
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
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
      alert('Error creating checkout session');
    }
  };


  const handleDeleteAccount = async () => {
    if (
      !confirm(
        'Are you sure you want to delete your SnipIt account? This will remove your topics, email settings, and email history.'
      )
    ) {
      return;
    }

    const confirmation = prompt(
      'To confirm account deletion, type DELETE in all caps and click OK.'
    );

    if (confirmation !== 'DELETE') {
      alert('Account deletion cancelled.');
      return;
    }

    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        alert(
          `Error deleting account: ${data.error || 'Unknown error'}${
            data.details ? `\n\n${data.details}` : ''
          }`
        );
        return;
      }

      alert(
        'Your account has been deleted and you will no longer receive daily digests. You will be redirected to the home page.'
      );

      // Sign out locally and redirect
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Error signing out after account deletion:', err);
      }

      router.push('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Error deleting account. Please try again.');
    }
  };

  useEffect(() => {
    if (activeTab === 'archive') {
      loadArchive();
    }
  }, [activeTab]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#FFA500]/30 border-t-[#FFA500] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const maxTopics = user?.subscription_tier === 'paid' ? 12 : 3;
  const canAddMore = topics.length < maxTopics;

  // Format delivery time for display
  const formatDeliveryTime = () => {
    // Delivery time is fixed globally to 6:30 AM EST for all users
    return '6:30 AM EST';
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <Navigation />

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="text-3xl font-medium text-white mb-3">
            Dashboard
          </h1>
          <p className="text-gray-400">
            Manage your topics and email preferences.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-[#1a1a1a] p-6 border border-[#FFA500]/20">
            <p className="text-sm text-gray-400 mb-2">Active Topics</p>
            <p className="text-3xl font-medium text-white">
              {topics.length}
            </p>
          </div>

          <div className="bg-[#1a1a1a] p-6 border border-[#FFA500]/20">
            <p className="text-sm text-gray-400 mb-2">Next Digest</p>
            <p className="text-lg font-medium text-white">
              {formatDeliveryTime()}
            </p>
          </div>

          <div className="bg-[#1a1a1a] p-6 border border-[#FFA500]/20">
            <p className="text-sm text-gray-400 mb-2">Status</p>
            <p className="text-lg font-medium text-white">
              {isPaused ? 'Paused' : 'Active'}
            </p>
          </div>

          <div className="bg-[#1a1a1a] p-6 border border-[#FFA500]/20">
            <p className="text-sm text-gray-400 mb-2">Plan</p>
            <p className="text-lg font-medium text-white">
              {user?.subscription_tier === 'paid' ? 'Pro' : 'Free'}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-[#1a1a1a] border border-[#FFA500]/20 mb-6">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('topics')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'topics'
                  ? 'border-[#FFA500] text-[#FFA500]'
                  : 'border-transparent text-gray-400 hover:text-[#FFA500]'
              }`}
            >
              Topics
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'settings'
                  ? 'border-[#FFA500] text-[#FFA500]'
                  : 'border-transparent text-gray-400 hover:text-[#FFA500]'
              }`}
            >
              Settings
            </button>
            <button
              onClick={() => setActiveTab('archive')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'archive'
                  ? 'border-[#FFA500] text-[#FFA500]'
                  : 'border-transparent text-gray-400 hover:text-[#FFA500]'
              }`}
            >
              Archive
            </button>
          </nav>
        </div>

        {/* Topics Tab */}
        {activeTab === 'topics' && (
          <div className="bg-[#1a1a1a] border border-[#FFA500]/20 p-8">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-lg font-medium text-white">
                Your Topics
              </h2>
              <div className="text-sm text-gray-400">
                {topics.length} / {maxTopics} topics
              </div>
            </div>

            {/* Selected Topics Summary */}
            {topics.length > 0 && (
              <div className="mb-8 p-4 bg-[#2a2a2a] rounded-lg border border-[#FFA500]/20">
                <div className="flex flex-wrap gap-2">
                  {topics.map((topic) => (
                    <div
                      key={topic.id}
                      className="flex items-center space-x-2 px-3 py-1.5 bg-[#FFA500]/10 border border-[#FFA500]/30 rounded-full text-sm text-white"
                    >
                      <Check className="w-4 h-4 text-[#FFA500]" />
                      <span>{topic.topic_name}</span>
                      <button
                        onClick={() => removeTopic(topic.id)}
                        className="text-gray-400 hover:text-red-400 transition-colors ml-1"
                        title="Remove topic"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                {canAddMore && (
                  <p className="mt-4 text-sm text-gray-400 text-center">
                    You can add {maxTopics - topics.length} more topic{maxTopics - topics.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}

            {/* Topic Selector */}
            <TopicSelector
              selectedTopics={topics}
              onAddTopic={addTopic}
              onRemoveTopic={removeTopic}
              maxTopics={maxTopics}
              canAddMore={canAddMore}
              isAddingTopic={isAddingTopic}
              compact={true}
            />

            {/* Upgrade CTA */}
            {user?.subscription_tier === 'free' && (
              <div className="mt-8 p-6 bg-[#1a1a1a] border border-[#FFA500]/30">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-white mb-1">
                      Upgrade to Pro
                    </h3>
                    <p className="text-sm text-gray-400">
                      Pro plan coming soon with 12 topics and paragraph summaries
                    </p>
                  </div>
                  <button
                    disabled
                    className="px-4 py-2 bg-gray-600 text-gray-300 text-sm font-medium cursor-not-allowed opacity-60 transition-all"
                  >
                    Coming Soon
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="bg-[#1a1a1a] border border-[#FFA500]/20 p-8">
            <h2 className="text-lg font-medium text-white mb-8">
              Email Settings
            </h2>

            <div className="space-y-6">
              {/* Pause/Resume */}
              <div className="flex items-center justify-between p-6 bg-[#1a1a1a] border border-[#FFA500]/20 mb-6">
                <div>
                  <h3 className="font-medium text-white mb-1">
                    Email Delivery
                  </h3>
                  <p className="text-sm text-gray-400">
                    {isPaused
                      ? 'Your daily digests are currently paused'
                      : 'Your daily digests are active'}
                  </p>
                </div>
                <button
                  onClick={togglePause}
                  className={`px-4 py-2 font-medium flex items-center space-x-2 transition-colors ${
                    isPaused
                      ? 'bg-gradient-to-r from-[#FFA500] to-[#FF6B47] text-[#1a1a1a] hover:from-[#FFD700] hover:to-[#FFA500]'
                      : 'bg-[#1a1a1a] border border-[#FFA500]/30 text-[#FFA500] hover:border-[#FFA500]'
                  }`}
                >
                  {isPaused ? (
                    <>
                      <Play className="w-4 h-4" />
                      <span>Resume</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4" />
                      <span>Pause</span>
                    </>
                  )}
                </button>
              </div>

              {/* Delivery Time Info */}
              <div className="p-6 bg-[#1a1a1a] border border-[#FFA500]/20 mb-6">
                <h3 className="font-medium text-white mb-2">
                  Delivery Time
                </h3>
                <p className="text-sm text-gray-400">
                  Your daily digest is sent at <strong className="text-white">6:30 AM EST</strong> every day. This time is fixed and cannot be changed.
                </p>
              </div>


              {/* Subscription & Account Management */}
              <div className="p-6 bg-[#1a1a1a] border border-[#FFA500]/20 space-y-6">
                <div>
                  <h3 className="font-medium text-white mb-2">Subscription</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    {user?.subscription_tier === 'paid'
                      ? 'You are on the Pro plan. Manage your subscription below.'
                      : 'Upgrade to Pro for more topics and better summaries.'}
                  </p>
                  <button
                    disabled={user?.subscription_tier !== 'paid'}
                    onClick={user?.subscription_tier === 'paid' ? handleUpgrade : undefined}
                    className={`px-4 py-2 font-medium transition-all ${
                      user?.subscription_tier === 'paid'
                        ? 'bg-gradient-to-r from-[#FFA500] to-[#FF6B47] text-[#1a1a1a] hover:from-[#FFD700] hover:to-[#FFA500]'
                        : 'bg-gray-600 text-gray-300 cursor-not-allowed opacity-60'
                    }`}
                  >
                    {user?.subscription_tier === 'paid'
                      ? 'Manage Subscription'
                      : 'Coming Soon'}
                  </button>
                </div>

                <div className="border-t border-[#FFA500]/20 pt-4 mt-2">
                  <h3 className="font-medium text-white mb-2">Account</h3>
                  <p className="text-sm text-gray-400 mb-3">
                    Deleting your account will remove your topics, email settings, and email history.
                    You will no longer receive SnipIt News digests.
                  </p>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition-colors"
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Archive Tab */}
        {activeTab === 'archive' && (
          <div className="bg-[#1a1a1a] border border-[#FFA500]/20 p-8">
            <h2 className="text-lg font-medium text-white mb-8">
              Email Archive
            </h2>

            {archive.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  No emails yet
                </h3>
                <p className="text-gray-400">
                  Your daily digests will appear here once they start being
                  sent.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {archive.map((email) => (
                  <div
                    key={email.id}
                    className="p-6 bg-[#1a1a1a] border border-[#FFA500]/20 hover:border-[#FFA500]/40 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-medium text-white mb-1">
                          {email.subject}
                        </h3>
                        <p className="text-sm text-gray-400">
                          {new Date(email.sent_at).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">
                        Topics: {email.topics.join(', ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
