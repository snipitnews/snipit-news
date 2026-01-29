'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { X, Check, ArrowRight, Crown, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { TOPICS, searchTopics } from '@/lib/topics';
import Navigation from '@/components/Navigation';

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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [isAddingTopic, setIsAddingTopic] = useState<string | null>(null);

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

  const isTopicSelected = (subtopic: string): boolean => {
    return topics.some((t) => t.topic_name.toLowerCase() === subtopic.toLowerCase());
  };

  const addTopic = async (subtopic: string) => {
    if (!user) return;

    const maxTopics = user.subscription_tier === 'paid' ? 12 : 3;
    
    if (topics.length >= maxTopics) {
      setError(
        `Topic limit reached. ${user.subscription_tier === 'paid' ? 'Pro' : 'Free'} tier allows ${maxTopics} topics.`
      );
      return;
    }

    if (isTopicSelected(subtopic)) {
      setError('This topic is already in your list.');
      return;
    }

    setIsAddingTopic(subtopic);
    setError('');
    
    try {
      const { data, error: insertError } = await supabase
        .from('user_topics')
        .insert({
          user_id: user.id,
          topic_name: subtopic.trim(),
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
    } catch (error) {
      console.error('Error adding topic:', error);
      setError('Error adding topic. Please try again.');
    } finally {
      setIsAddingTopic(null);
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

  const toggleTopic = (topicName: string) => {
    const newExpanded = new Set(expandedTopics);
    if (newExpanded.has(topicName)) {
      newExpanded.delete(topicName);
    } else {
      newExpanded.add(topicName);
    }
    setExpandedTopics(newExpanded);
  };

  const handleContinue = async () => {
    if (topics.length === 0) {
      setError('Please select at least one topic to continue.');
      return;
    }

    setIsSaving(true);
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

  // Filter topics based on search
  const filteredTopics = useMemo(() => {
    if (!searchQuery.trim()) {
      return TOPICS;
    }

    const searchResults = searchTopics(searchQuery);
    const mainTopicsMap = new Map<string, string[]>();

    searchResults.forEach(({ mainTopic, subtopic }) => {
      if (!mainTopicsMap.has(mainTopic)) {
        mainTopicsMap.set(mainTopic, []);
      }
      mainTopicsMap.get(mainTopic)!.push(subtopic);
    });

    return TOPICS.filter((topic) => mainTopicsMap.has(topic.name)).map((topic) => ({
      ...topic,
      subtopics: mainTopicsMap.get(topic.name) || topic.subtopics,
    }));
  }, [searchQuery]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFA500] mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  const maxTopics = user?.subscription_tier === 'paid' ? 12 : 3;
  const canAddMore = topics.length < maxTopics;
  const remainingTopics = maxTopics - topics.length;

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <Navigation />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Choose Your Topics
          </h1>
          <p className="text-xl text-gray-400 mb-2">
            Select the topics you want to stay informed about
          </p>
          <p className="text-sm text-gray-500">
            {user?.subscription_tier === 'paid' ? (
              <>Pro plan: Up to 12 topics</>
            ) : (
              <>Free plan: Up to 3 topics • <span className="text-[#FFA500] opacity-60">Pro plan coming soon</span> for 12 topics</>
            )}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Selected Topics Summary */}
        {topics.length > 0 && (
          <div className="bg-[#2a2a2a] rounded-lg shadow-lg p-6 mb-8 border border-[#FFA500]/20">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-white">
                Your Topics ({topics.length} / {maxTopics})
              </h2>
              {!canAddMore && user?.subscription_tier === 'free' && (
                <span className="text-sm text-[#FFA500] opacity-60 font-medium flex items-center space-x-1">
                  <Crown className="w-4 h-4" />
                  <span>Pro plan coming soon</span>
                </span>
              )}
            </div>
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
                You can add {remainingTopics} more topic{remainingTopics !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setError('');
              }}
              placeholder="Search topics..."
              className="w-full pl-12 pr-4 py-3 bg-[#2a2a2a] border border-[#FFA500]/20 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#FFA500] focus:border-transparent"
            />
          </div>
        </div>

        {/* Topics Grid */}
        <div className="space-y-4 mb-12">
          {filteredTopics.map((mainTopic) => {
            const isExpanded = expandedTopics.has(mainTopic.name);
            const hasSelectedSubtopics = mainTopic.subtopics.some((subtopic) =>
              isTopicSelected(subtopic)
            );

            return (
              <div
                key={mainTopic.name}
                className="bg-[#2a2a2a] rounded-lg border border-[#FFA500]/20 overflow-hidden"
              >
                {/* Main Topic Header */}
                <button
                  onClick={() => toggleTopic(mainTopic.name)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#333333] transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-[#FFA500] to-[#FF6B47] rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">
                        {mainTopic.name.charAt(0)}
                      </span>
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-semibold text-white">
                        {mainTopic.name}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {mainTopic.subtopics.length} subtopics
                        {hasSelectedSubtopics && (
                          <span className="ml-2 text-[#FFA500]">
                            • {mainTopic.subtopics.filter((s) => isTopicSelected(s)).length} selected
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {/* Subtopics Grid */}
                {isExpanded && (
                  <div className="px-6 py-4 border-t border-[#FFA500]/10">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {mainTopic.subtopics.map((subtopic) => {
                        const selected = isTopicSelected(subtopic);
                        const isAdding = isAddingTopic === subtopic;

                        return (
                          <button
                            key={subtopic}
                            onClick={() => {
                              if (selected) {
                                const topicToRemove = topics.find(
                                  (t) => t.topic_name.toLowerCase() === subtopic.toLowerCase()
                                );
                                if (topicToRemove) {
                                  removeTopic(topicToRemove.id);
                                }
                              } else {
                                addTopic(subtopic);
                              }
                            }}
                            disabled={isAdding || (!selected && !canAddMore)}
                            className={`px-4 py-3 rounded-lg border transition-all text-left ${
                              selected
                                ? 'bg-[#FFA500]/20 border-[#FFA500] text-white'
                                : canAddMore
                                ? 'bg-[#333333] border-[#FFA500]/20 text-gray-300 hover:bg-[#3a3a3a] hover:border-[#FFA500]/40'
                                : 'bg-[#2a2a2a] border-gray-700 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{subtopic}</span>
                              {selected && (
                                <Check className="w-4 h-4 text-[#FFA500] flex-shrink-0 ml-2" />
                              )}
                            </div>
                            {isAdding && (
                              <div className="mt-2 text-xs text-gray-400">Adding...</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Continue Button */}
        <div className="flex justify-center mb-8">
          <button
            onClick={handleContinue}
            disabled={isSaving || topics.length === 0}
            className="px-8 py-4 bg-gradient-to-r from-[#FFA500] to-[#FF6B47] text-white font-semibold rounded-lg hover:from-[#FFB84D] hover:to-[#FF7A5C] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-2 text-lg"
          >
            <span>{isSaving ? 'Saving...' : 'Continue to Dashboard'}</span>
            {!isSaving && <ArrowRight className="w-5 h-5" />}
          </button>
        </div>

        {/* Upgrade CTA for Free Users */}
        {user?.subscription_tier === 'free' && topics.length >= 3 && (
          <div className="p-6 bg-gradient-to-r from-[#FFA500]/10 to-[#FF6B47]/10 rounded-lg border border-[#FFA500]/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Crown className="w-6 h-6 text-[#FFA500]" />
                <div>
                  <h3 className="font-semibold text-white">Want More Topics?</h3>
                  <p className="text-sm text-gray-400">
                    Pro plan coming soon with 12 topics and better summaries
                  </p>
                </div>
              </div>
              <button
                disabled
                className="px-4 py-2 bg-gray-600 text-gray-300 font-medium rounded-lg cursor-not-allowed opacity-60 transition-all"
              >
                Coming Soon
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
