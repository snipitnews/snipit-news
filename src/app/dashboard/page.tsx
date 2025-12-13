'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Plus, X, Crown, Clock, Pause, Play, Mail } from 'lucide-react';

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
  const [newTopic, setNewTopic] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [emailSettings, setEmailSettings] = useState<EmailSettings | null>(
    null
  );
  const [deliveryTime, setDeliveryTime] = useState('08:00');
  const [timezone, setTimezone] = useState('America/New_York');
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
          // Parse delivery time (format: HH:MM:SS-TZ)
          if (settings.delivery_time) {
            const timeMatch = settings.delivery_time.match(/(\d{2}):(\d{2})/);
            if (timeMatch) {
              setDeliveryTime(`${timeMatch[1]}:${timeMatch[2]}`);
            }
          }
          if (settings.timezone) {
            setTimezone(settings.timezone);
          }
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

  const addTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic.trim() || !user) return;

    setIsAddingTopic(true);
    try {
      const { data, error } = await supabase
        .from('user_topics')
        .insert({
          user_id: user.id,
          topic_name: newTopic.trim(),
        })
        .select()
        .single();

      if (error) {
        if (error.message.includes('Topic limit exceeded')) {
          alert(
            'Topic limit exceeded. Free tier allows 5 topics, paid tier allows 10 topics.'
          );
        } else {
          alert('Error adding topic: ' + error.message);
        }
        return;
      }

      setTopics([...topics, data]);
      setNewTopic('');
    } catch (error) {
      console.error('Error adding topic:', error);
      alert('Error adding topic');
    } finally {
      setIsAddingTopic(false);
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
          delivery_time: `${deliveryTime}:00-05:00`, // Simplified timezone handling
          timezone: timezone,
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
          delivery_time: emailSettings?.delivery_time || '08:00:00-05:00',
          timezone: emailSettings?.timezone || 'America/New_York',
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const handleTestEmail = async () => {
    if (!confirm('Send a test email digest to your email address?')) return;

    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok) {
        alert(
          `✅ ${data.message}\n\nTopics: ${data.topics.join(
            ', '
          )}\nSummaries: ${data.summariesCount}`
        );
        // Reload archive to show the new email
        if (activeTab === 'archive') {
          loadArchive();
        }
      } else {
        alert(`❌ Error: ${data.error}\n\n${data.details || ''}`);
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      alert('Error sending test email. Please check the console for details.');
    }
  };

  useEffect(() => {
    if (activeTab === 'archive') {
      loadArchive();
    }
  }, [activeTab]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const maxTopics = user?.subscription_tier === 'paid' ? 12 : 5;
  const canAddMore = topics.length < maxTopics;

  // Format delivery time for display
  const formatDeliveryTime = () => {
    if (!emailSettings) return '8:00 AM EST';
    const timeMatch = emailSettings.delivery_time?.match(/(\d{2}):(\d{2})/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
      return `${displayHours}:${minutes} ${ampm} ${
        emailSettings.timezone === 'America/New_York' ? 'EST' : 'Local'
      }`;
    }
    return '8:00 AM EST';
  };

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

            <div className="flex items-center space-x-4">
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
              <button
                onClick={handleSignOut}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to SnipIt! 👋
          </h1>
          <p className="text-gray-600">
            Choose the topics you want to stay informed about. We&apos;ll send
            you a daily digest every morning.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📰</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Active Topics
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {topics.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Next Digest</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatDeliveryTime()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  isPaused ? 'bg-red-100' : 'bg-green-100'
                }`}
              >
                {isPaused ? (
                  <Pause className="w-6 h-6 text-red-500" />
                ) : (
                  <Play className="w-6 h-6 text-green-500" />
                )}
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Status</p>
                <p className="text-lg font-bold text-gray-900">
                  {isPaused ? 'Paused' : 'Active'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📧</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Plan</p>
                <p className="text-2xl font-bold text-gray-900">
                  {user?.subscription_tier === 'paid' ? 'Pro' : 'Free'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('topics')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'topics'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Topics
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'settings'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Settings
              </button>
              <button
                onClick={() => setActiveTab('archive')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'archive'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Archive
              </button>
            </nav>
          </div>
        </div>

        {/* Topics Tab */}
        {activeTab === 'topics' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Your Topics
              </h2>
              <div className="text-sm text-gray-600">
                {topics.length} / {maxTopics} topics
              </div>
            </div>

            {/* Add Topic Form */}
            {canAddMore && (
              <form onSubmit={addTopic} className="mb-6">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    placeholder="e.g., artificial intelligence, climate change, sports, tech, crypto"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    disabled={isAddingTopic}
                  />
                  <button
                    type="submit"
                    disabled={isAddingTopic || !newTopic.trim()}
                    className="px-6 py-2 bg-gradient-to-r from-orange-400 to-orange-500 text-white font-medium rounded-lg hover:from-orange-500 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isAddingTopic ? 'Adding...' : 'Add Topic'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Topics List */}
            {topics.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📝</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No topics yet
                </h3>
                <p className="text-gray-600 mb-4">
                  Add your first topic to start receiving personalized news
                  digests.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {topics.map((topic) => (
                  <div
                    key={topic.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <span className="font-medium text-gray-900">
                        {topic.topic_name}
                      </span>
                    </div>
                    <button
                      onClick={() => removeTopic(topic.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upgrade CTA */}
            {user?.subscription_tier === 'free' && (
              <div className="mt-6 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg border border-orange-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Crown className="w-6 h-6 text-yellow-500" />
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        Upgrade to Pro
                      </h3>
                      <p className="text-sm text-gray-600">
                        Get 12 topics and paragraph summaries for just
                        $2.99/month
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleUpgrade}
                    className="px-4 py-2 bg-gradient-to-r from-orange-400 to-orange-500 text-white font-medium rounded-lg hover:from-orange-500 hover:to-orange-600 transition-all duration-200"
                  >
                    Upgrade Now
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Email Settings
            </h2>

            <div className="space-y-6">
              {/* Pause/Resume */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-900 mb-1">
                    Email Delivery
                  </h3>
                  <p className="text-sm text-gray-600">
                    {isPaused
                      ? 'Your daily digests are currently paused'
                      : 'Your daily digests are active'}
                  </p>
                </div>
                <button
                  onClick={togglePause}
                  className={`px-4 py-2 rounded-lg font-medium flex items-center space-x-2 ${
                    isPaused
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-red-500 text-white hover:bg-red-600'
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

              {/* Delivery Time */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-4">
                  Delivery Time
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Time
                    </label>
                    <input
                      type="time"
                      value={deliveryTime}
                      onChange={(e) => setDeliveryTime(e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Timezone
                    </label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent w-full"
                    >
                      <option value="America/New_York">
                        Eastern Time (EST/EDT)
                      </option>
                      <option value="America/Chicago">
                        Central Time (CST/CDT)
                      </option>
                      <option value="America/Denver">
                        Mountain Time (MST/MDT)
                      </option>
                      <option value="America/Los_Angeles">
                        Pacific Time (PST/PDT)
                      </option>
                      <option value="Europe/London">London (GMT/BST)</option>
                      <option value="Europe/Paris">Paris (CET/CEST)</option>
                      <option value="Asia/Tokyo">Tokyo (JST)</option>
                    </select>
                  </div>
                  <button
                    onClick={updateEmailSettings}
                    className="px-4 py-2 bg-gradient-to-r from-orange-400 to-orange-500 text-white font-medium rounded-lg hover:from-orange-500 hover:to-orange-600 transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </div>

              {/* Test Email */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-medium text-gray-900 mb-2">Test Email</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Send yourself a test email digest with your current topics to
                  see how it looks.
                </p>
                <button
                  onClick={handleTestEmail}
                  disabled={topics.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Send Test Email
                </button>
                {topics.length === 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Add topics first to test the email
                  </p>
                )}
              </div>

              {/* Subscription Management */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Subscription</h3>
                <p className="text-sm text-gray-600 mb-4">
                  {user?.subscription_tier === 'paid'
                    ? 'You are on the Pro plan. Manage your subscription below.'
                    : 'Upgrade to Pro for more topics and better summaries.'}
                </p>
                <button
                  onClick={handleUpgrade}
                  className="px-4 py-2 bg-gradient-to-r from-orange-400 to-orange-500 text-white font-medium rounded-lg hover:from-orange-500 hover:to-orange-600 transition-all"
                >
                  {user?.subscription_tier === 'paid'
                    ? 'Manage Subscription'
                    : 'Upgrade to Pro'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Archive Tab */}
        {activeTab === 'archive' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Email Archive
            </h2>

            {archive.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No emails yet
                </h3>
                <p className="text-gray-600">
                  Your daily digests will appear here once they start being
                  sent.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {archive.map((email) => (
                  <div
                    key={email.id}
                    className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {email.subject}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {new Date(email.sent_at).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className="text-sm text-gray-600">
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
