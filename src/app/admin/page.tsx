'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';
import { Plus, X, Edit2, Save, ChevronDown, ChevronUp, Users, BookOpen, Trash2 } from 'lucide-react';

interface User {
  id: string;
  email: string;
  tier: 'free' | 'paid';
  role: 'user' | 'admin';
  createdAt: string;
  topics: Array<{
    id: string;
    topic_name: string;
    created_at: string;
  }>;
  topicCount: number;
}

interface Topic {
  id: string;
  name: string;
  main_category: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminPortal() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'users' | 'topics'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [groupedTopics, setGroupedTopics] = useState<Record<string, Topic[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState('');
  
  // Topic management state
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicCategory, setNewTopicCategory] = useState('');
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  // User role editing state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<'user' | 'admin'>('user');

  // Topic editing state
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingTopicName, setEditingTopicName] = useState<string>('');
  const [isSavingTopic, setIsSavingTopic] = useState(false);

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'topics' && isAuthorized) {
      loadTopics();
    }
  }, [activeTab, isAuthorized]);

  const checkAuthAndLoadData = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/');
        return;
      }

      // Check if user is admin
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (!userData || userData.role !== 'admin') {
        setError('You do not have permission to access this page.');
        setIsLoading(false);
        return;
      }

      setIsAuthorized(true);
      await loadUsers();
    } catch (error) {
      console.error('Error loading admin data:', error);
      setError('An error occurred while loading data.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 403) {
          setError('You do not have permission to access this page.');
        } else {
          setError('Failed to load users.');
        }
        return;
      }

      const { users: usersData } = await response.json();
      setUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
      setError('Failed to load users.');
    }
  };

  const loadTopics = async () => {
    try {
      const response = await fetch('/api/admin/topics', {
        credentials: 'include',
      });

      if (!response.ok) {
        setError('Failed to load topics.');
        return;
      }

      const { topics: topicsData, groupedTopics: grouped } = await response.json();
      setTopics(topicsData || []);
      setGroupedTopics(grouped || {});
    } catch (error) {
      console.error('Error loading topics:', error);
      setError('Failed to load topics.');
    }
  };

  const addTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newTopicName.trim()) {
      setError('Topic name is required.');
      return;
    }

    if (!isNewCategory && !newTopicCategory.trim()) {
      setError('Please select a category or create a new one.');
      return;
    }

    if (isNewCategory && !newTopicCategory.trim()) {
      setError('New category name is required.');
      return;
    }

    setIsAddingTopic(true);
    setError('');

    try {
      const response = await fetch('/api/admin/topics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: newTopicName.trim(),
          main_category: newTopicCategory.trim(),
        }),
      });

      if (!response.ok) {
        const { error: errorData } = await response.json();
        setError(errorData || 'Failed to add topic.');
        return;
      }

      const { topic } = await response.json();
      
      // Add to local state
      setTopics([...topics, topic]);
      
      // Update grouped topics
      if (!groupedTopics[topic.main_category]) {
        groupedTopics[topic.main_category] = [];
      }
      groupedTopics[topic.main_category].push(topic);
      setGroupedTopics({ ...groupedTopics });

      // Reset form
      setNewTopicName('');
      setNewTopicCategory('');
      setIsNewCategory(false);
    } catch (error) {
      console.error('Error adding topic:', error);
      setError('Failed to add topic.');
    } finally {
      setIsAddingTopic(false);
    }
  };

  const startEditingTopic = (topic: Topic) => {
    setEditingTopicId(topic.id);
    setEditingTopicName(topic.name);
  };

  const cancelEditingTopic = () => {
    setEditingTopicId(null);
    setEditingTopicName('');
  };

  const saveTopic = async () => {
    if (!editingTopicId || !editingTopicName.trim()) return;

    setIsSavingTopic(true);
    try {
      const response = await fetch('/api/admin/topics', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          id: editingTopicId,
          name: editingTopicName.trim(),
        }),
      });

      if (!response.ok) {
        const { error: errorData } = await response.json();
        alert(errorData || 'Failed to update topic.');
        return;
      }

      const { topic: updatedTopic } = await response.json();

      // Update flat topics list
      const updatedTopics = topics.map((t) =>
        t.id === updatedTopic.id ? updatedTopic : t
      );
      setTopics(updatedTopics);

      // Update grouped topics
      const newGrouped: Record<string, Topic[]> = {};
      updatedTopics.forEach((t) => {
        if (!newGrouped[t.main_category]) {
          newGrouped[t.main_category] = [];
        }
        newGrouped[t.main_category].push(t);
      });
      setGroupedTopics(newGrouped);

      cancelEditingTopic();
    } catch (error) {
      console.error('Error updating topic:', error);
      alert('Failed to update topic.');
    } finally {
      setIsSavingTopic(false);
    }
  };

  const deleteTopic = async (topic: Topic) => {
    if (
      !confirm(
        `Are you sure you want to delete the topic "${topic.name}"? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/topics?id=${encodeURIComponent(topic.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const { error: errorData } = await response.json();
        alert(errorData || 'Failed to delete topic.');
        return;
      }

      // Remove from flat topics list
      const updatedTopics = topics.filter((t) => t.id !== topic.id);
      setTopics(updatedTopics);

      // Update grouped topics
      const newGrouped: Record<string, Topic[]> = {};
      updatedTopics.forEach((t) => {
        if (!newGrouped[t.main_category]) {
          newGrouped[t.main_category] = [];
        }
        newGrouped[t.main_category].push(t);
      });
      setGroupedTopics(newGrouped);

      // Reset editing state if needed
      if (editingTopicId === topic.id) {
        cancelEditingTopic();
      }
    } catch (error) {
      console.error('Error deleting topic:', error);
      alert('Failed to delete topic.');
    }
  };

  const updateUserRole = async (userId: string, newRole: 'user' | 'admin') => {
    if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const { error: errorData } = await response.json();
        alert(errorData || 'Failed to update user role.');
        return;
      }

      // Update local state
      setUsers(users.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      setEditingUserId(null);
    } catch (error) {
      console.error('Error updating user role:', error);
      alert('Failed to update user role.');
    }
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Get unique categories for dropdown
  const categories = Object.keys(groupedTopics).sort();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#FFA500]/30 border-t-[#FFA500] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized || error) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-medium text-white mb-2">Access Denied</h1>
          <p className="text-gray-400 mb-6">{error || 'You do not have permission to access this page.'}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-[#FFA500] text-[#1a1a1a] text-sm font-medium hover:bg-[#FFD700] transition-colors rounded-lg"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const totalUsers = users.length;
  const freeUsers = users.filter((u) => u.tier === 'free').length;
  const paidUsers = users.filter((u) => u.tier === 'paid').length;
  const totalTopics = users.reduce((sum, u) => sum + u.topicCount, 0);

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <Navigation />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-medium text-white">Admin Portal</h1>
          <p className="text-sm text-gray-400 mt-1">Manage users and topics</p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mb-8 border-b border-[#FFA500]/20">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 font-medium transition-colors flex items-center space-x-2 ${
              activeTab === 'users'
                ? 'text-[#FFA500] border-b-2 border-[#FFA500]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users</span>
          </button>
          <button
            onClick={() => setActiveTab('topics')}
            className={`px-6 py-3 font-medium transition-colors flex items-center space-x-2 ${
              activeTab === 'topics'
                ? 'text-[#FFA500] border-b-2 border-[#FFA500]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Topics</span>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-[#2a2a2a] border border-[#FFA500]/20 p-6 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Total Users</p>
                <p className="text-3xl font-medium text-white">{totalUsers}</p>
              </div>
              <div className="bg-[#2a2a2a] border border-[#FFA500]/20 p-6 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Free Tier</p>
                <p className="text-3xl font-medium text-white">{freeUsers}</p>
              </div>
              <div className="bg-[#2a2a2a] border border-[#FFA500]/20 p-6 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Pro Tier</p>
                <p className="text-3xl font-medium text-white">{paidUsers}</p>
              </div>
              <div className="bg-[#2a2a2a] border border-[#FFA500]/20 p-6 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Total Topics</p>
                <p className="text-3xl font-medium text-white">{totalTopics}</p>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-[#2a2a2a] border border-[#FFA500]/20 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-[#FFA500]/20">
                <h2 className="text-lg font-medium text-white">All Users</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#FFA500]/20">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Tier
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Topics
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Joined
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#FFA500]/10">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                          No users found
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user.id} className="hover:bg-[#333333] transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-white">{user.email}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                                user.tier === 'paid'
                                  ? 'bg-[#FFA500]/20 text-[#FFA500] border border-[#FFA500]/30'
                                  : 'bg-gray-700 text-gray-300'
                              }`}
                            >
                              {user.tier === 'paid' ? 'Pro' : 'Free'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {editingUserId === user.id ? (
                              <div className="flex items-center space-x-2">
                                <select
                                  value={editingRole}
                                  onChange={(e) => setEditingRole(e.target.value as 'user' | 'admin')}
                                  className="px-2 py-1 bg-[#1a1a1a] border border-[#FFA500]/30 text-white text-xs rounded focus:outline-none focus:ring-1 focus:ring-[#FFA500]"
                                >
                                  <option value="user">User</option>
                                  <option value="admin">Admin</option>
                                </select>
                                <button
                                  onClick={() => updateUserRole(user.id, editingRole)}
                                  className="text-[#FFA500] hover:text-[#FFD700] transition-colors"
                                  title="Save"
                                >
                                  <Save className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingUserId(null);
                                    setEditingRole('user');
                                  }}
                                  className="text-gray-400 hover:text-white transition-colors"
                                  title="Cancel"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                                    user.role === 'admin'
                                      ? 'bg-[#FFA500]/20 text-[#FFA500] border border-[#FFA500]/30'
                                      : 'bg-gray-700 text-gray-300'
                                  }`}
                                >
                                  {user.role === 'admin' ? 'Admin' : 'User'}
                                </span>
                                <button
                                  onClick={() => {
                                    setEditingUserId(user.id);
                                    setEditingRole(user.role);
                                  }}
                                  className="text-gray-400 hover:text-[#FFA500] transition-colors"
                                  title="Edit role"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-white">{user.topicCount}</div>
                            {user.topics.length > 0 && (
                              <div className="mt-1">
                                <details className="group">
                                  <summary className="text-xs text-gray-400 cursor-pointer hover:text-[#FFA500]">
                                    View topics
                                  </summary>
                                  <div className="mt-2 space-y-1">
                                    {user.topics.map((topic) => (
                                      <div key={topic.id} className="text-xs text-gray-300 pl-2">
                                        • {topic.topic_name}
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-400">
                            {formatDate(user.createdAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Topics Tab */}
        {activeTab === 'topics' && (
          <>
            {/* Add Topic Form */}
            <div className="bg-[#2a2a2a] border border-[#FFA500]/20 rounded-lg p-6 mb-8">
              <h2 className="text-lg font-medium text-white mb-4">Add New Topic</h2>
              <form onSubmit={addTopic} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Topic Name
                  </label>
                  <input
                    type="text"
                    value={newTopicName}
                    onChange={(e) => setNewTopicName(e.target.value)}
                    placeholder="e.g., Formula 1, Quantum Computing"
                    className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#FFA500]/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFA500] focus:border-transparent"
                    required
                    disabled={isAddingTopic}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Category
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        checked={!isNewCategory}
                        onChange={() => setIsNewCategory(false)}
                        className="text-[#FFA500] focus:ring-[#FFA500]"
                      />
                      <span className="text-sm text-gray-300">Select existing category</span>
                    </label>
                    {!isNewCategory && (
                      <select
                        value={newTopicCategory}
                        onChange={(e) => setNewTopicCategory(e.target.value)}
                        className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#FFA500]/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#FFA500] focus:border-transparent"
                        required={!isNewCategory}
                      >
                        <option value="">Select a category...</option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    )}
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        checked={isNewCategory}
                        onChange={() => setIsNewCategory(true)}
                        className="text-[#FFA500] focus:ring-[#FFA500]"
                      />
                      <span className="text-sm text-gray-300">Create new category</span>
                    </label>
                    {isNewCategory && (
                      <input
                        type="text"
                        value={newTopicCategory}
                        onChange={(e) => setNewTopicCategory(e.target.value)}
                        placeholder="e.g., Fashion, Real Estate"
                        className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#FFA500]/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFA500] focus:border-transparent"
                        required={isNewCategory}
                      />
                    )}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isAddingTopic}
                  className="px-6 py-3 bg-gradient-to-r from-[#FFA500] to-[#FF6B47] text-[#1a1a1a] font-medium rounded-lg hover:from-[#FFD700] hover:to-[#FFA500] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isAddingTopic ? 'Adding...' : 'Add Topic'}</span>
                </button>
              </form>
            </div>

            {/* Topics List */}
            <div className="bg-[#2a2a2a] border border-[#FFA500]/20 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-[#FFA500]/20">
                <h2 className="text-lg font-medium text-white">
                  All Topics ({topics.length})
                </h2>
              </div>
              <div className="divide-y divide-[#FFA500]/10">
                {Object.keys(groupedTopics).length === 0 ? (
                  <div className="px-6 py-12 text-center text-gray-400">
                    No topics found. Add your first topic above.
                  </div>
                ) : (
                  Object.entries(groupedTopics)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([category, categoryTopics]) => {
                      const isExpanded = expandedCategories.has(category);
                      return (
                        <div key={category} className="border-b border-[#FFA500]/10 last:border-b-0">
                          <button
                            onClick={() => toggleCategory(category)}
                            className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#333333] transition-colors"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-gradient-to-r from-[#FFA500] to-[#FF6B47] rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-xs">
                                  {category.charAt(0)}
                                </span>
                              </div>
                              <div className="text-left">
                                <h3 className="text-base font-semibold text-white">{category}</h3>
                                <p className="text-xs text-gray-400">
                                  {categoryTopics.length} topic{categoryTopics.length !== 1 ? 's' : ''}
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
                            <div className="px-6 py-4 bg-[#1a1a1a]">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {categoryTopics.map((topic) => (
                                  <div
                                    key={topic.id}
                                    className="px-3 py-2 bg-[#2a2a2a] border border-[#FFA500]/20 rounded text-sm text-white flex items-center justify-between space-x-2"
                                  >
                                    {editingTopicId === topic.id ? (
                                      <>
                                        <input
                                          type="text"
                                          value={editingTopicName}
                                          onChange={(e) => setEditingTopicName(e.target.value)}
                                          className="flex-1 bg-[#1a1a1a] border border-[#FFA500]/40 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#FFA500]"
                                        />
                                        <button
                                          type="button"
                                          onClick={saveTopic}
                                          disabled={isSavingTopic}
                                          className="text-[#FFA500] hover:text-[#FFD700] disabled:opacity-50"
                                          title="Save"
                                        >
                                          <Save className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={cancelEditingTopic}
                                          className="text-gray-400 hover:text-white"
                                          title="Cancel"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <span className="flex-1 truncate">{topic.name}</span>
                                        <div className="flex items-center space-x-1">
                                          <button
                                            type="button"
                                            onClick={() => startEditingTopic(topic)}
                                            className="text-gray-400 hover:text-[#FFA500]"
                                            title="Edit topic name"
                                          >
                                            <Edit2 className="w-3 h-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => deleteTopic(topic)}
                                            className="text-gray-500 hover:text-red-400"
                                            title="Delete topic"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
