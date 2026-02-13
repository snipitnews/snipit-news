'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import Navigation from '@/components/Navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Check,
  Clock,
  Target,
  Zap,
  Plus,
  X,
  ArrowRight,
  Star,
  Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { IPhoneVideoMockup } from '@/components/IPhoneVideoMockup';

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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkUserStatus();

    // Listen to auth state changes to update UI immediately on sign out
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (!session) {
        // User signed out - clear state immediately
        setUser(null);
        setTopics([]);
        setEmail('');
        setIsCheckingUser(false);
      } else {
        // User signed in - reload user data
        checkUserStatus();
      }
    });

    // Listen for auth success from other tabs (magic link opened in new tab)
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('snipit-auth');
        channel.onmessage = (event) => {
          if (event.data.type === 'AUTH_SUCCESS') {
            console.log('🔔 Auth success received from another tab, refreshing...');
            // Refresh the page to pick up the new session
            checkUserStatus();
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel not supported:', e);
    }

    // Fallback: Listen for localStorage changes (for browsers without BroadcastChannel)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'snipit-auth-success' && event.newValue) {
        console.log('🔔 Auth success detected via localStorage, refreshing...');
        checkUserStatus();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      subscription.unsubscribe();
      if (channel) {
        channel.close();
      }
      window.removeEventListener('storage', handleStorageChange);
    };
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

          // Load topics but don't redirect - let existing users stay on home page
          const { data: topicsData } = await supabase
            .from('user_topics')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: true });

          if (topicsData) {
            setTopics(topicsData);
            // If user has no topics, redirect to topics page
            if (topicsData.length === 0) {
              router.push('/topics');
              return;
            }
            // If user has topics, stay on home page (don't redirect)
          } else {
            // No topics found, redirect to topics page
            router.push('/topics');
            return;
          }
        } else {
          // No user data found - clear state
          setUser(null);
          setTopics([]);
          setEmail('');
        }
      } else {
        // No session - clear state
        setUser(null);
        setTopics([]);
        setEmail('');
      }
    } catch (error) {
      console.error('Error checking user status:', error);
      // On error, clear state to show login form
      setUser(null);
      setTopics([]);
      setEmail('');
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
      // Use window.location.origin to ensure we always use the correct domain
      // This works correctly in both development and production
      const appUrl = window.location.origin;
      
      console.log('🔗 [SignIn] Using app URL for magic link:', appUrl);
      
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Point to /auth/confirm which verifies token_hash server-side
          // Supports both magiclink (existing users) and signup (new users) flows
          // This is device-agnostic and works across browsers/devices
          emailRedirectTo: `${appUrl}/auth/confirm`,
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

    const maxTopics = user.role === 'admin' ? 10 : user.subscription_tier === 'paid' ? 12 : 3;

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

  const maxTopics = user?.role === 'admin' ? 10 : user?.subscription_tier === 'paid' ? 12 : 3;
  const canAddMore = user ? topics.length < maxTopics : true;
  const remainingTopics = user ? maxTopics - topics.length : 0;
  const isExistingUser = user !== null;

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <Navigation />

      {/* Hero Section - Stripe-like Design */}
      <section ref={containerRef} className="relative min-h-screen w-full overflow-hidden bg-[#030303]">
        {/* Background gradients */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#FFA500]/[0.03] via-transparent to-[#FF6B47]/[0.03] blur-3xl" />
        
        <motion.div className="relative z-10">
          <div className="container mx-auto px-4 md:px-6 pt-20 md:pt-32 pb-24">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-12 md:mb-16">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] mb-8"
                >
                  <div className="h-2 w-2 rounded-full bg-[#FFA500]/80 animate-pulse" />
                  <span className="text-sm text-white/60 tracking-wide">Trusted by hundreds of readers worldwide</span>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                  className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 leading-[1.1] overflow-visible"
                >
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-white/90 to-[#FFA500] pr-4 inline-block pb-1">
                    <span className="font-bold">Stay Informed</span>{' '}
                    <span className="italic font-normal">in Under 60 Seconds.</span>
                  </span>
                </motion.h1>

                {isExistingUser ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.5 }}
                    className="max-w-2xl mx-auto mt-12"
                  >
                    <p className="text-lg sm:text-xl text-white/50 mb-8 leading-relaxed font-light">
                      Welcome back! Manage your topics and preferences.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <button
                        onClick={() => router.push('/topics')}
                        className="px-8 py-4 bg-gradient-to-r from-[#FFA500] to-[#FF6B47] text-[#1a1a1a] font-semibold hover:from-[#FFD700] hover:to-[#FFA500] transition-all flex items-center justify-center space-x-2 rounded-full shadow-lg shadow-[#FFA500]/25"
                      >
                        <span>Manage Topics</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleGoToDashboard}
                        className="px-8 py-4 bg-white/[0.05] border border-white/[0.1] text-white font-medium hover:bg-white/[0.1] transition-all rounded-full"
                      >
                        Go to Dashboard
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <>
                    <motion.p
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.4 }}
                      className="text-lg sm:text-xl md:text-2xl text-white/50 mb-10 leading-relaxed font-light max-w-3xl mx-auto"
                    >
                      Personalized bite-size news on the topics you care about—<span className="font-bold">no fluff</span>. Just the facts that matter.
                    </motion.p>

                    <motion.form
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.5 }}
                      id="hero-signup"
                      onSubmit={handleSubmit}
                      className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mb-4"
                    >
                      <div className="relative flex-1">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Enter your email"
                          className="w-full pl-12 pr-4 py-3 h-12 bg-white/[0.05] border border-white/[0.1] text-white placeholder:text-white/40 focus:border-white/30 rounded-full focus:outline-none focus:ring-2 focus:ring-[#FFA500]/50"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="h-12 px-8 bg-gradient-to-r from-[#FFA500] to-[#FF6B47] hover:from-[#FFD700] hover:to-[#FFA500] text-[#1a1a1a] font-semibold rounded-full shadow-lg shadow-[#FFA500]/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        {isLoading ? 'Sending...' : 'Start Free'}
                        {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                      </button>
                    </motion.form>
                    {message && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={`mt-4 text-sm ${
                          message.includes('Check your email')
                            ? 'text-[#FFA500]'
                            : 'text-red-400'
                        }`}
                      >
                        {message}
                      </motion.p>
                    )}
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6 }}
                      className="text-sm text-white/40 mt-2"
                    >
                      Free forever • No credit card required
                    </motion.p>
                  </>
                )}
              </div>

              {/* Video Showcase - iPhone Frame */}
              {!isExistingUser && (
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.7 }}
                  className="max-w-5xl mx-auto mt-16 md:mt-24 flex justify-center"
                >
                  <IPhoneVideoMockup
                    model="15-pro"
                    color="space-black"
                    className="scale-75 md:scale-100"
                  />
                </motion.div>
              )}

              {/* Stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.9 }}
                className="mt-16 md:mt-24 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto"
              >
                {[
                  { value: '6:45 AM', label: 'Daily Delivery' },
                  { value: '3', label: 'Topics Free' },
                  { value: '60s', label: 'Read Time' },
                  { value: 'AI', label: 'Powered' },
                ].map((stat, i) => (
                  <div key={i} className="text-center">
                    <div className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#FFB84D] to-[#FF8C69] mb-2">
                      {stat.value}
                    </div>
                    <div className="text-sm text-white/90">{stat.label}</div>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>
        </motion.div>


        <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-[#030303]/80 pointer-events-none" />
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
                Receive your personalized news digest every morning at 6:45 AM.
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
                  <span className="text-gray-300">Up to 3 topics</span>
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
              Stay informed, cut the fluff.
            </p>
            <p className="text-sm text-gray-500">
              © 2026 SnipIt. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

