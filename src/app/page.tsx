'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Check,
  Clock,
  Target,
  Zap,
  Plus,
  X,
  ArrowRight,
  Crown,
} from 'lucide-react';

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

export default function LandingPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [newTopic, setNewTopic] = useState('');
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [isCheckingUser, setIsCheckingUser] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    checkUserStatus();
  }, []);

  const checkUserStatus = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        // Check if user exists in users table
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (userData) {
          setUser(userData);
          setEmail(userData.email);

          // Load existing topics
          const { data: topicsData } = await supabase
            .from('user_topics')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: true });

          if (topicsData) {
            setTopics(topicsData);
          }
        }
      }
    } catch (error) {
      console.error('Error checking user status:', error);
    } finally {
      setIsCheckingUser(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Use client-side callback - createBrowserClient handles PKCE automatically
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setMessage(`Error sending magic link: ${error.message}`);
        console.error('Detailed error:', error);
      } else {
        setMessage('Check your email for a magic link to get started!');
      }
    } catch (error) {
      setMessage('Something went wrong. Please try again.');
      console.error('Error:', error);
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
        `Topic limit reached. ${
          user.subscription_tier === 'paid' ? 'Pro' : 'Free'
        } tier allows ${maxTopics} topics.`
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
            `Topic limit exceeded. ${
              user.subscription_tier === 'paid' ? 'Pro' : 'Free'
            } tier allows ${maxTopics} topics.`
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

  const handleGoToDashboard = () => {
    window.location.href = '/dashboard';
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

  if (isCheckingUser) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const maxTopics = user?.subscription_tier === 'paid' ? 12 : 5;
  const canAddMore = user ? topics.length < maxTopics : true;
  const remainingTopics = user ? maxTopics - topics.length : 0;
  const isExistingUser = user !== null;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <span className="text-xl font-bold text-gray-900">SnipIt</span>
            </div>
            <nav className="hidden md:flex space-x-8">
              <a
                href="#features"
                className="text-gray-600 hover:text-orange-500 transition-colors"
              >
                Features
              </a>
              <a
                href="#pricing"
                className="text-gray-600 hover:text-orange-500 transition-colors"
              >
                Pricing
              </a>
              <a
                href="#how-it-works"
                className="text-gray-600 hover:text-orange-500 transition-colors"
              >
                How it Works
              </a>
            </nav>
            {isExistingUser ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">{user.email}</span>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    user.subscription_tier === 'paid'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {user.subscription_tier === 'paid' ? 'Pro' : 'Free'}
                </span>
                <button
                  onClick={handleGoToDashboard}
                  className="bg-gradient-to-r from-orange-400 to-orange-500 text-white px-6 py-2 rounded-lg font-semibold hover:from-orange-500 hover:to-orange-600 transition-all"
                >
                  Dashboard
                </button>
              </div>
            ) : (
              <button className="hidden md:block bg-gradient-to-r from-orange-400 to-orange-500 text-white px-6 py-2 rounded-lg font-semibold hover:from-orange-500 hover:to-orange-600 transition-all">
                Get Started
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Your daily news,{' '}
              <span className="bg-gradient-to-r from-orange-400 to-orange-500 bg-clip-text text-transparent">
                summarized
              </span>
            </h1>

            {isExistingUser ? (
              // Existing User - Topic Selection Interface
              <div className="max-w-3xl mx-auto">
                <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
                  Welcome back! Select the topics you want to stay informed
                  about.
                </p>

                {/* Error Message */}
                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg max-w-2xl mx-auto">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                {/* Add Topic Form */}
                {canAddMore && (
                  <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                      Add a Topic
                    </h2>
                    <form onSubmit={addTopic} className="mb-4">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="text"
                          value={newTopic}
                          onChange={(e) => {
                            setNewTopic(e.target.value);
                            setError('');
                          }}
                          placeholder="e.g., artificial intelligence, tech, crypto, sports"
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-gray-900 placeholder:text-gray-400 bg-white"
                          disabled={isAddingTopic}
                        />
                        <button
                          type="submit"
                          disabled={isAddingTopic || !newTopic.trim()}
                          className="px-6 py-3 bg-gradient-to-r from-orange-400 to-orange-500 text-white font-semibold rounded-lg hover:from-orange-500 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                        >
                          <Plus className="w-5 h-5" />
                          <span>
                            {isAddingTopic ? 'Adding...' : 'Add Topic'}
                          </span>
                        </button>
                      </div>
                    </form>

                    {/* Popular Topics Suggestions */}
                    <div className="mt-4">
                      <p className="text-sm text-gray-600 mb-2">
                        Popular topics:
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {popularTopics
                          .filter(
                            (topic) =>
                              !topics.some(
                                (t) =>
                                  t.topic_name.toLowerCase() ===
                                  topic.toLowerCase()
                              )
                          )
                          .slice(0, 8)
                          .map((topic) => (
                            <button
                              key={topic}
                              onClick={() => {
                                setNewTopic(topic);
                                setError('');
                              }}
                              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium rounded-full transition-colors border border-gray-200"
                            >
                              {topic}
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Selected Topics */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Your Topics ({topics.length} / {maxTopics})
                    </h2>
                    {!canAddMore && user.subscription_tier === 'free' && (
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
                    <div className="text-center py-8">
                      <p className="text-gray-600">
                        Add your first topic above to get started
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {topics.map((topic) => (
                        <div
                          key={topic.id}
                          className="flex items-center justify-between p-3 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg border border-orange-100"
                        >
                          <div className="flex items-center space-x-2">
                            <Check className="w-4 h-4 text-orange-500" />
                            <span className="font-medium text-gray-900">
                              {topic.topic_name}
                            </span>
                          </div>
                          <button
                            onClick={() => removeTopic(topic.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                            title="Remove topic"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {canAddMore && topics.length > 0 && (
                    <p className="mt-4 text-sm text-gray-500 text-center">
                      You can add {remainingTopics} more topic
                      {remainingTopics !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {/* Continue Button */}
                {topics.length > 0 && (
                  <button
                    onClick={handleGoToDashboard}
                    className="w-full max-w-md mx-auto px-8 py-4 bg-gradient-to-r from-orange-400 to-orange-500 text-white font-semibold rounded-lg hover:from-orange-500 hover:to-orange-600 transition-all flex items-center justify-center space-x-2 text-lg"
                  >
                    <span>Go to Dashboard</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                )}

                {/* Upgrade CTA for Free Users */}
                {user.subscription_tier === 'free' && topics.length >= 3 && (
                  <div className="mt-6 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg border border-orange-200 max-w-2xl mx-auto">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Crown className="w-5 h-5 text-yellow-500" />
                        <div>
                          <h3 className="font-semibold text-gray-900 text-sm">
                            Want More Topics?
                          </h3>
                          <p className="text-xs text-gray-600">
                            Upgrade to Pro for 12 topics
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleUpgrade}
                        className="px-4 py-2 bg-gradient-to-r from-orange-400 to-orange-500 text-white font-medium rounded-lg hover:from-orange-500 hover:to-orange-600 transition-all text-sm"
                      >
                        Upgrade
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // New User - Signup Form
              <>
                <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed">
                  Get the most important news stories delivered to your inbox
                  every morning. AI-powered summaries that save you time while
                  keeping you informed.
                </p>

                {/* Email Signup Form */}
                <form onSubmit={handleSubmit} className="max-w-lg mx-auto mb-8">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email address"
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-gray-900 placeholder-gray-500"
                      required
                    />
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-8 py-3 bg-gradient-to-r from-orange-400 to-orange-500 text-white font-semibold rounded-lg hover:from-orange-500 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {isLoading ? 'Sending...' : 'Start Free'}
                    </button>
                  </div>
                  {message && (
                    <p
                      className={`mt-3 text-sm ${
                        message.includes('Check your email')
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {message}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 mt-3">
                    Free forever • No credit card required
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Why choose SnipIt?
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Clock className="w-10 h-10 text-orange-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Quick & Concise
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Get the essential news in under 2 minutes. No fluff, just the
                facts you need to stay informed.
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Target className="w-10 h-10 text-blue-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Personalized Topics
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Choose your interests and get news tailored to what matters most
                to you.
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Zap className="w-10 h-10 text-green-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                AI-Powered Summaries
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Advanced AI analyzes and summarizes the most important stories
                from trusted sources.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              How it works
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                1
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Choose your interests
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Select the topics you care about most - from tech to politics to
                sports.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-orange-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                2
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                AI does the work
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Our AI scans thousands of sources and creates concise summaries
                of the most important stories.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-orange-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                3
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Get your digest
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Receive your personalized news digest every morning at 8 AM EST.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Simple pricing
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <div className="bg-white p-8 rounded-2xl border-2 border-gray-200 shadow-sm">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Free</h3>
              <div className="flex items-baseline mb-6">
                <span className="text-5xl font-bold text-gray-900">$0</span>
                <span className="text-lg text-gray-600 ml-2">/month</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center">
                  <Check className="w-5 h-5 text-green-500 mr-3" />
                  <span className="text-gray-900">Up to 5 topics</span>
                </li>
                <li className="flex items-center">
                  <Check className="w-5 h-5 text-green-500 mr-3" />
                  <span className="text-gray-900">Daily email digest</span>
                </li>
                <li className="flex items-center">
                  <Check className="w-5 h-5 text-green-500 mr-3" />
                  <span className="text-gray-900">Basic summaries</span>
                </li>
                <li className="flex items-center">
                  <Check className="w-5 h-5 text-green-500 mr-3" />
                  <span className="text-gray-900">Link to full articles</span>
                </li>
              </ul>
              <button className="w-full py-3 px-6 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:border-gray-400 transition-colors">
                Get Started Free
              </button>
            </div>

            {/* Pro Plan */}
            <div className="bg-white p-8 rounded-2xl border-2 border-orange-500 shadow-lg relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-orange-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                  Most Popular
                </span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2 mt-2">
                Pro
              </h3>
              <div className="flex items-baseline mb-6">
                <span className="text-5xl font-bold text-gray-900">$2.99</span>
                <span className="text-lg text-gray-600 ml-2">/month</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center">
                  <Check className="w-5 h-5 text-green-500 mr-3" />
                  <span className="text-gray-900">Up to 12 topics</span>
                </li>
                <li className="flex items-center">
                  <Check className="w-5 h-5 text-green-500 mr-3" />
                  <span className="text-gray-900">Daily email digest</span>
                </li>
                <li className="flex items-center">
                  <Check className="w-5 h-5 text-green-500 mr-3" />
                  <span className="text-gray-900">Detailed summaries</span>
                </li>
                <li className="flex items-center">
                  <Check className="w-5 h-5 text-green-500 mr-3" />
                  <span className="text-gray-900">Priority support</span>
                </li>
              </ul>
              <button className="w-full py-3 px-6 bg-gradient-to-r from-orange-400 to-orange-500 text-white font-semibold rounded-lg hover:from-orange-500 hover:to-orange-600 transition-all">
                Start Pro Trial
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-6">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <span className="text-2xl font-bold">SnipIt</span>
            </div>
            <p className="text-gray-400 mb-4 text-lg">
              Stay informed, stay focused.
            </p>
            <p className="text-gray-500 text-sm">
              © 2024 SnipIt. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
