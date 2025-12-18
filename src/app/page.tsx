'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  Check,
  Clock,
  Target,
  Zap,
  Plus,
  X,
  ArrowRight,
  Star,
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
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (userData) {
          setUser(userData);
          setEmail(userData.email);

          // Redirect logged-in users to topics page if they have no topics, or dashboard if they do
          const { data: topicsData } = await supabase
            .from('user_topics')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: true });

          if (topicsData) {
            setTopics(topicsData);
            // If user has topics, they can stay on landing page or go to dashboard
            // If no topics, redirect to topics page
            if (topicsData.length === 0) {
              router.push('/topics');
              return;
            }
          } else {
            // No topics found, redirect to topics page
            router.push('/topics');
            return;
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
          // Point to API route for server-side code exchange first
          // The API route will handle PKCE exchange or redirect to client-side for OTP verification
          // Make sure your Supabase dashboard redirect URL includes: http://localhost:3000/api/auth/callback
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
          shouldCreateUser: true,
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
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#FFA500]/30 border-t-[#FFA500] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  const maxTopics = user?.subscription_tier === 'paid' ? 12 : 5;
  const canAddMore = user ? topics.length < maxTopics : true;
  const remainingTopics = user ? maxTopics - topics.length : 0;
  const isExistingUser = user !== null;

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <Navigation />

      {/* Hero Section */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-medium text-white mb-6 leading-tight tracking-tight">
              Your daily news,{' '}
              <span className="bg-gradient-to-r from-[#FFA500] to-[#FF6B47] bg-clip-text text-transparent">summarized</span>
            </h1>

            {isExistingUser ? (
              <div className="max-w-2xl mx-auto mt-12">
                <p className="text-lg text-gray-400 mb-8 leading-relaxed">
                  Welcome back! Manage your topics and preferences.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={() => router.push('/topics')}
                    className="px-8 py-4 bg-gradient-to-r from-[#FFA500] to-[#FF6B47] text-[#1a1a1a] font-medium hover:from-[#FFD700] hover:to-[#FFA500] transition-all flex items-center justify-center space-x-2"
                  >
                    <span>Manage Topics</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleGoToDashboard}
                    className="px-8 py-4 bg-[#2a2a2a] border border-[#FFA500]/30 text-white font-medium hover:bg-[#333333] transition-all"
                  >
                    Go to Dashboard
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
                  Get the most important news stories delivered to your inbox
                  every morning. AI-powered summaries that save you time while
                  keeping you informed.
                </p>

                <form id="hero-signup" onSubmit={handleSubmit} className="max-w-lg mx-auto mb-8">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email address"
                      className="flex-1 px-4 py-3 border border-[#FFA500]/30 bg-[#1a1a1a] text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#FFA500] focus:border-[#FFA500]"
                      required
                    />
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-8 py-3 bg-gradient-to-r from-[#FFA500] to-[#FF6B47] text-[#1a1a1a] font-medium hover:from-[#FFD700] hover:to-[#FFA500] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {isLoading ? 'Sending...' : 'Start Free'}
                    </button>
                  </div>
                  {message && (
                    <p
                      className={`mt-4 text-sm ${
                        message.includes('Check your email')
                          ? 'text-[#FFA500]'
                          : 'text-red-400'
                      }`}
                    >
                      {message}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 mt-4">
                    Free forever • No credit card required
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-[#1a1a1a] border-t border-[#FFA500]/10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-medium text-white mb-4">
              Why choose SnipIt?
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <div>
              <div className="mb-6">
                <Clock className="w-8 h-8 text-[#FFA500]" />
              </div>
              <h3 className="text-lg font-medium text-white mb-3">
                Quick & Concise
              </h3>
              <p className="text-gray-400 leading-relaxed">
                Get the essential news in under 2 minutes. No fluff, just the
                facts you need to stay informed.
              </p>
            </div>

            <div>
              <div className="mb-6">
                <Target className="w-8 h-8 text-[#FFA500]" />
              </div>
              <h3 className="text-lg font-medium text-white mb-3">
                Personalized Topics
              </h3>
              <p className="text-gray-400 leading-relaxed">
                Choose your interests and get news tailored to what matters most
                to you.
              </p>
            </div>

            <div>
              <div className="mb-6">
                <Zap className="w-8 h-8 text-[#FFA500]" />
              </div>
              <h3 className="text-lg font-medium text-white mb-3">
                AI-Powered Summaries
              </h3>
              <p className="text-gray-400 leading-relaxed">
                Advanced AI analyzes and summarizes the most important stories
                from trusted sources.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 bg-[#1a1a1a] border-t border-[#FFA500]/10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-medium text-white mb-4">
              How it works
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-[#FFA500] to-[#FF6B47] text-[#1a1a1a] rounded-full flex items-center justify-center text-lg font-medium mx-auto mb-6">
                1
              </div>
              <h3 className="text-lg font-medium text-white mb-3">
                Choose your interests
              </h3>
              <p className="text-gray-400 leading-relaxed">
                Select the topics you care about most - from tech to politics to
                sports.
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-[#FFA500] to-[#FF6B47] text-[#1a1a1a] rounded-full flex items-center justify-center text-lg font-medium mx-auto mb-6">
                2
              </div>
              <h3 className="text-lg font-medium text-white mb-3">
                AI does the work
              </h3>
              <p className="text-gray-400 leading-relaxed">
                Our AI scans thousands of sources and creates concise summaries
                of the most important stories.
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-[#FFA500] to-[#FF6B47] text-[#1a1a1a] rounded-full flex items-center justify-center text-lg font-medium mx-auto mb-6">
                3
              </div>
              <h3 className="text-lg font-medium text-white mb-3">
                Get your digest
              </h3>
              <p className="text-gray-400 leading-relaxed">
                Receive your personalized news digest every morning at 8 AM EST.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 bg-[#1a1a1a] border-t border-[#FFA500]/10">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-medium text-white mb-4">
              Simple pricing
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            <div className="bg-[#1a1a1a] p-8 border-2 border-[#FFA500] relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-gradient-to-r from-[#FFA500] to-[#FF6B47] text-[#1a1a1a] px-3 py-1 text-xs font-medium flex items-center gap-1">
                  <Star className="w-3 h-3 fill-current" />
                  Popular
                </span>
              </div>
              <h3 className="text-xl font-medium text-white mb-2 mt-2">Free</h3>
              <div className="flex items-baseline mb-6">
                <span className="text-4xl font-medium text-white">$0</span>
                <span className="text-base text-gray-400 ml-2">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <Check className="w-5 h-5 text-[#FFA500] mr-3 flex-shrink-0" />
                  <span className="text-gray-300">Up to 5 topics</span>
                </li>
                <li className="flex items-center">
                  <Check className="w-5 h-5 text-[#FFA500] mr-3 flex-shrink-0" />
                  <span className="text-gray-300">Daily email digest</span>
                </li>
                <li className="flex items-center">
                  <Check className="w-5 h-5 text-[#FFA500] mr-3 flex-shrink-0" />
                  <span className="text-gray-300">Basic summaries</span>
                </li>
                <li className="flex items-center">
                  <Check className="w-5 h-5 text-[#FFA500] mr-3 flex-shrink-0" />
                  <span className="text-gray-300">Link to full articles</span>
                </li>
              </ul>
              <button 
                onClick={() => {
                  const heroSection = document.getElementById('hero-signup');
                  if (heroSection) {
                    heroSection.scrollIntoView({ behavior: 'smooth' });
                  } else {
                    window.location.href = '/#hero-signup';
                  }
                }}
                className="w-full py-3 px-6 border border-[#FFA500]/30 text-white font-medium hover:border-[#FFA500] hover:bg-[#FFA500]/10 transition-colors"
              >
                Get Started Free
              </button>
            </div>

            <div className="bg-[#1a1a1a] p-8 border border-[#FFA500]/20 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-gray-600 text-gray-300 px-3 py-1 text-xs font-medium">
                  Coming Soon
                </span>
              </div>
              <h3 className="text-xl font-medium text-white mb-2 mt-2">
                Pro
              </h3>
              <div className="flex items-baseline mb-6">
                <span className="text-4xl font-medium text-white">$2.99</span>
                <span className="text-base text-gray-400 ml-2">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <Check className="w-5 h-5 text-[#FFA500] mr-3 flex-shrink-0" />
                  <span className="text-gray-300">Up to 12 topics</span>
                </li>
                <li className="flex items-center">
                  <Check className="w-5 h-5 text-[#FFA500] mr-3 flex-shrink-0" />
                  <span className="text-gray-300">Daily email digest</span>
                </li>
                <li className="flex items-center">
                  <Check className="w-5 h-5 text-[#FFA500] mr-3 flex-shrink-0" />
                  <span className="text-gray-300">Detailed summaries</span>
                </li>
                <li className="flex items-center">
                  <Check className="w-5 h-5 text-[#FFA500] mr-3 flex-shrink-0" />
                  <span className="text-gray-300">Priority support</span>
                </li>
              </ul>
              <button 
                disabled
                className="w-full py-3 px-6 bg-gray-600 text-gray-300 font-medium cursor-not-allowed opacity-60 transition-all"
              >
                Coming Soon
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1a1a1a] border-t border-[#FFA500]/10 py-12">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center">
            <Link href="/" className="flex items-center justify-center space-x-2 mb-4">
              <Image
                src="/logos/Asset 3@4x-8.png"
                alt="SnipIt"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="text-lg font-medium text-white">SnipIt</span>
            </Link>
            <p className="text-gray-400 mb-2">
              Stay informed, stay focused.
            </p>
            <p className="text-sm text-gray-500">
              © 2024 SnipIt. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

