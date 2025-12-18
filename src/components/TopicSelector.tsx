'use client';

import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, Check, X } from 'lucide-react';
import { TOPICS, searchTopics } from '@/lib/topics';

interface Topic {
  id: string;
  topic_name: string;
  created_at: string;
}

interface TopicSelectorProps {
  selectedTopics: Topic[];
  onAddTopic: (subtopic: string) => Promise<void>;
  onRemoveTopic: (topicId: string) => Promise<void>;
  maxTopics: number;
  canAddMore: boolean;
  isAddingTopic?: string | null;
  className?: string;
  compact?: boolean;
}

export default function TopicSelector({
  selectedTopics,
  onAddTopic,
  onRemoveTopic,
  maxTopics,
  canAddMore,
  isAddingTopic = null,
  className = '',
  compact = false,
}: TopicSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  const isTopicSelected = (subtopic: string): boolean => {
    return selectedTopics.some((t) => t.topic_name.toLowerCase() === subtopic.toLowerCase());
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

  if (compact) {
    // Compact view for dashboard
    return (
      <div className={className}>
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topics..."
              className="w-full pl-12 pr-4 py-3 bg-[#2a2a2a] border border-[#FFA500]/20 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#FFA500] focus:border-transparent"
            />
          </div>
        </div>

        {/* Topics Grid - Compact */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
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
                <button
                  onClick={() => toggleTopic(mainTopic.name)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#333333] transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-[#FFA500] to-[#FF6B47] rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-xs">
                        {mainTopic.name.charAt(0)}
                      </span>
                    </div>
                    <div className="text-left">
                      <h3 className="text-sm font-semibold text-white">{mainTopic.name}</h3>
                      <p className="text-xs text-gray-400">
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
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-4 py-3 border-t border-[#FFA500]/10">
                    <div className="grid grid-cols-2 gap-2">
                      {mainTopic.subtopics.map((subtopic) => {
                        const selected = isTopicSelected(subtopic);
                        const isAdding = isAddingTopic === subtopic;

                        return (
                          <button
                            key={subtopic}
                            onClick={() => {
                              if (selected) {
                                const topicToRemove = selectedTopics.find(
                                  (t) => t.topic_name.toLowerCase() === subtopic.toLowerCase()
                                );
                                if (topicToRemove) {
                                  onRemoveTopic(topicToRemove.id);
                                }
                              } else {
                                onAddTopic(subtopic);
                              }
                            }}
                            disabled={isAdding || (!selected && !canAddMore)}
                            className={`px-3 py-2 rounded-lg border transition-all text-left text-sm ${
                              selected
                                ? 'bg-[#FFA500]/20 border-[#FFA500] text-white'
                                : canAddMore
                                ? 'bg-[#333333] border-[#FFA500]/20 text-gray-300 hover:bg-[#3a3a3a] hover:border-[#FFA500]/40'
                                : 'bg-[#2a2a2a] border-gray-700 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs">{subtopic}</span>
                              {selected && (
                                <Check className="w-3 h-3 text-[#FFA500] flex-shrink-0 ml-2" />
                              )}
                            </div>
                            {isAdding && (
                              <div className="mt-1 text-xs text-gray-400">Adding...</div>
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
      </div>
    );
  }

  // Full view (for topics page)
  return (
    <div className={className}>
      {/* Search Bar */}
      <div className="mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search topics..."
            className="w-full pl-12 pr-4 py-3 bg-[#2a2a2a] border border-[#FFA500]/20 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#FFA500] focus:border-transparent"
          />
        </div>
      </div>

      {/* Topics Grid */}
      <div className="space-y-4">
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
                    <h3 className="text-lg font-semibold text-white">{mainTopic.name}</h3>
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
                              const topicToRemove = selectedTopics.find(
                                (t) => t.topic_name.toLowerCase() === subtopic.toLowerCase()
                              );
                              if (topicToRemove) {
                                onRemoveTopic(topicToRemove.id);
                              }
                            } else {
                              onAddTopic(subtopic);
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
    </div>
  );
}

