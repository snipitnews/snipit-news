'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/Navigation';
import {
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Edit2,
  Save,
  RotateCcw,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  Trash2,
} from 'lucide-react';

interface DraftSummaryItem {
  title: string;
  summary: string;
  bullets?: string[];
  url: string;
  source: string;
}

interface DraftSummary {
  id: string;
  topic: string;
  send_date: string;
  is_paid: boolean;
  status: 'draft' | 'approved' | 'rejected';
  original_summaries: DraftSummaryItem[];
  edited_summaries: DraftSummaryItem[];
  is_edited: boolean;
  edited_by: string | null;
  approved_by: string | null;
  internal_note: string | null;
  created_at: string;
  updated_at: string;
}

interface Stats {
  total: number;
  draft: number;
  approved: number;
  rejected: number;
}

function getTomorrowDate(): string {
  const nowEST = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  nowEST.setDate(nowEST.getDate() + 1);
  return `${nowEST.getFullYear()}-${String(nowEST.getMonth() + 1).padStart(2, '0')}-${String(nowEST.getDate()).padStart(2, '0')}`;
}

function isInReviewWindow(): boolean {
  const now = new Date();
  const eastern = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  );
  const hours = eastern.getHours();
  // Review window: 8 PM (20) to 6:45 AM next day
  return hours >= 20 || hours < 7;
}

export default function DraftReviewPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState('');

  const [selectedDate, setSelectedDate] = useState(getTomorrowDate());
  const [statusFilter, setStatusFilter] = useState('all');
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, draft: 0, approved: 0, rejected: 0 });
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);

  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editingSummaries, setEditingSummaries] = useState<DraftSummaryItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [noteEditId, setNoteEditId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const [fallbackSetting, setFallbackSetting] = useState('exclude');
  const [isApprovingAll, setIsApprovingAll] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthorized) {
      loadDrafts();
      loadSettings();
    }
  }, [isAuthorized, selectedDate]);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }

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
    } catch {
      setError('An error occurred while checking authorization.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDrafts = async () => {
    setIsLoadingDrafts(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/drafts?date=${selectedDate}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDrafts(data.drafts || []);
      setStats(data.stats || { total: 0, draft: 0, approved: 0, rejected: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load drafts');
    } finally {
      setIsLoadingDrafts(false);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/admin/drafts/settings', {
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.settings) {
        setFallbackSetting(data.settings.unapproved_fallback || 'exclude');
      }
    } catch {
      // Settings load failure is non-critical
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/drafts/${id}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDrafts((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...data.draft } : d))
      );
      updateStatsFromDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/drafts/${id}/reject`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDrafts((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...data.draft } : d))
      );
      updateStatsFromDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    }
  };

  const handleReset = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/drafts/${id}/reset`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDrafts((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...data.draft } : d))
      );
      setEditingDraftId(null);
      updateStatsFromDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset');
    }
  };

  const startEditing = (draft: DraftSummary) => {
    setEditingDraftId(draft.id);
    setEditingSummaries(JSON.parse(JSON.stringify(draft.edited_summaries)));
  };

  const cancelEditing = () => {
    setEditingDraftId(null);
    setEditingSummaries([]);
  };

  const saveEditing = async () => {
    if (!editingDraftId) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/drafts', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingDraftId,
          edited_summaries: editingSummaries,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDrafts((prev) =>
        prev.map((d) => (d.id === editingDraftId ? { ...d, ...data.draft } : d))
      );
      setEditingDraftId(null);
      setEditingSummaries([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save edits');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNote = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/drafts/${id}/note`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDrafts((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...data.draft } : d))
      );
      setNoteEditId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note');
    }
  };

  const handleFallbackChange = async (value: string) => {
    setFallbackSetting(value);
    try {
      const res = await fetch('/api/admin/drafts/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'unapproved_fallback', value }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update setting');
    }
  };

  const handleApproveAll = async () => {
    const pendingDrafts = drafts.filter((d) => d.status === 'draft');
    if (pendingDrafts.length === 0) return;
    if (!confirm(`Approve all ${pendingDrafts.length} pending drafts?`)) return;

    setIsApprovingAll(true);
    try {
      await Promise.all(
        pendingDrafts.map((d) =>
          fetch(`/api/admin/drafts/${d.id}/approve`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          })
        )
      );
      await loadDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve all');
    } finally {
      setIsApprovingAll(false);
    }
  };

  const updateStatsFromDrafts = () => {
    // Recalculate after optimistic update — use setTimeout to let state settle
    setTimeout(() => {
      setDrafts((current) => {
        setStats({
          total: current.length,
          draft: current.filter((d) => d.status === 'draft').length,
          approved: current.filter((d) => d.status === 'approved').length,
          rejected: current.filter((d) => d.status === 'rejected').length,
        });
        return current;
      });
    }, 0);
  };

  const toggleTopic = (id: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredDrafts = useMemo(() => {
    if (statusFilter === 'all') return drafts;
    return drafts.filter((d) => d.status === statusFilter);
  }, [drafts, statusFilter]);

  const updateBullet = (summaryIndex: number, bulletIndex: number, value: string) => {
    setEditingSummaries((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      if (next[summaryIndex].bullets) {
        next[summaryIndex].bullets[bulletIndex] = value;
      }
      return next;
    });
  };

  const updateSummaryText = (summaryIndex: number, value: string) => {
    setEditingSummaries((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[summaryIndex].summary = value;
      return next;
    });
  };

  const updateTitle = (summaryIndex: number, value: string) => {
    setEditingSummaries((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[summaryIndex].title = value;
      return next;
    });
  };

  const updateUrl = (summaryIndex: number, value: string) => {
    setEditingSummaries((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[summaryIndex].url = value;
      return next;
    });
  };

  const addArticle = () => {
    setEditingSummaries((prev) => [
      ...prev,
      { title: 'New Article', summary: '', bullets: [''], url: '', source: '' },
    ]);
  };

  const deleteArticle = (summaryIndex: number) => {
    const article = editingSummaries[summaryIndex];
    if (!confirm(`Delete article "${article.title}"? This will remove the article and all its bullets.`)) return;
    setEditingSummaries((prev) => prev.filter((_, i) => i !== summaryIndex));
  };

  const addBullet = (summaryIndex: number) => {
    setEditingSummaries((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next[summaryIndex].bullets) {
        next[summaryIndex].bullets = [];
      }
      next[summaryIndex].bullets.push('');
      return next;
    });
  };

  const deleteBullet = (summaryIndex: number, bulletIndex: number) => {
    if (!confirm('Delete this bullet point?')) return;
    setEditingSummaries((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      if (next[summaryIndex].bullets) {
        next[summaryIndex].bullets.splice(bulletIndex, 1);
      }
      return next;
    });
  };

  // Loading state
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

  // Unauthorized state
  if (!isAuthorized) {
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

  const inReviewWindow = isInReviewWindow();

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <Navigation />
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-medium text-white">Draft Review</h1>
              <p className="text-sm text-gray-400 mt-1">
                Review and approve AI-generated summaries before sending
              </p>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Back to Admin
            </button>
          </div>
        </div>

        {/* Timeline Bar */}
        <div className="mb-6 bg-[#252525] rounded-lg p-4 border border-[#333]">
          <div className="flex items-center justify-between relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-[#333] -translate-y-1/2" />
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-[#FFA500] mb-1" />
              <span className="text-xs text-gray-400">8:00 PM EST</span>
              <span className="text-xs text-gray-500">Drafts Generated</span>
            </div>
            <div className="relative z-10 flex flex-col items-center">
              <div
                className={`w-3 h-3 rounded-full mb-1 ${
                  inReviewWindow
                    ? 'bg-orange-400 animate-pulse'
                    : 'bg-[#555]'
                }`}
              />
              <span className={`text-xs ${inReviewWindow ? 'text-orange-400' : 'text-gray-400'}`}>
                Review Window
              </span>
              <span className="text-xs text-gray-500">
                {inReviewWindow ? 'Active now' : 'Inactive'}
              </span>
            </div>
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-[#555] mb-1" />
              <span className="text-xs text-gray-400">6:45 AM EST</span>
              <span className="text-xs text-gray-500">Sends</span>
            </div>
          </div>
        </div>

        {/* Controls Row */}
        <div className="mb-6 flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Send Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#FFA500]"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#FFA500]"
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Unapproved Fallback</label>
            <select
              value={fallbackSetting}
              onChange={(e) => handleFallbackChange(e.target.value)}
              className="bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#FFA500]"
            >
              <option value="exclude">Exclude</option>
              <option value="send_anyway">Send Anyway</option>
            </select>
          </div>

          <div className="ml-auto self-end">
            <button
              onClick={handleApproveAll}
              disabled={isApprovingAll || stats.draft === 0}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApprovingAll ? 'Approving...' : `Approve All Remaining (${stats.draft})`}
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="mb-6 grid grid-cols-4 gap-4">
          <div className="bg-[#252525] rounded-lg p-3 border border-[#333] text-center">
            <div className="text-lg font-medium text-white">{stats.total}</div>
            <div className="text-xs text-gray-400">Total</div>
          </div>
          <div className="bg-[#252525] rounded-lg p-3 border border-yellow-500/30 text-center">
            <div className="text-lg font-medium text-yellow-400">{stats.draft}</div>
            <div className="text-xs text-yellow-400/70">Pending</div>
          </div>
          <div className="bg-[#252525] rounded-lg p-3 border border-green-500/30 text-center">
            <div className="text-lg font-medium text-green-400">{stats.approved}</div>
            <div className="text-xs text-green-400/70">Approved</div>
          </div>
          <div className="bg-[#252525] rounded-lg p-3 border border-red-500/30 text-center">
            <div className="text-lg font-medium text-red-400">{stats.rejected}</div>
            <div className="text-xs text-red-400/70">Rejected</div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Draft List */}
        {isLoadingDrafts ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-[#FFA500]/30 border-t-[#FFA500] rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400 text-sm">Loading drafts...</p>
          </div>
        ) : filteredDrafts.length === 0 ? (
          <div className="text-center py-12">
            <AlertTriangle className="w-8 h-8 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-400">No drafts found for this date.</p>
            <p className="text-gray-500 text-sm mt-1">
              Drafts are generated at 8:00 PM EST each night.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDrafts.map((draft) => {
              const isExpanded = expandedTopics.has(draft.id);
              const isEditing = editingDraftId === draft.id;
              const summariesToShow = isEditing
                ? editingSummaries
                : draft.edited_summaries;

              return (
                <div
                  key={draft.id}
                  className="bg-[#252525] rounded-lg border border-[#333] overflow-hidden"
                >
                  {/* Topic Row */}
                  <div className="flex items-center px-4 py-3">
                    <button
                      onClick={() => toggleTopic(draft.id)}
                      className="mr-3 text-gray-400 hover:text-white transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    <span className="text-white font-medium flex-1">
                      {draft.topic}
                    </span>

                    {/* Badges */}
                    {draft.is_edited ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 mr-2">
                        Edited
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 mr-2">
                        AI
                      </span>
                    )}

                    {/* Status Badge */}
                    {draft.status === 'draft' && (
                      <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 mr-3">
                        <Clock className="w-3 h-3 inline mr-1" />
                        Draft
                      </span>
                    )}
                    {draft.status === 'approved' && (
                      <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400 mr-3">
                        <CheckCircle className="w-3 h-3 inline mr-1" />
                        Approved
                      </span>
                    )}
                    {draft.status === 'rejected' && (
                      <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400 mr-3">
                        <XCircle className="w-3 h-3 inline mr-1" />
                        Rejected
                      </span>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      {draft.status !== 'approved' && (
                        <button
                          onClick={() => handleApprove(draft.id)}
                          className="p-1.5 rounded bg-green-600/20 text-green-400 hover:bg-green-600/40 transition-colors"
                          title="Approve"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      {draft.status !== 'rejected' && (
                        <button
                          onClick={() => handleReject(draft.id)}
                          className="p-1.5 rounded bg-red-600/20 text-red-400 hover:bg-red-600/40 transition-colors"
                          title="Reject"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-[#333] px-4 py-4">
                      {/* Edit/Save Controls */}
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs text-gray-500">
                          {draft.edited_summaries.length} article{draft.edited_summaries.length !== 1 ? 's' : ''}
                          {draft.approved_by && (
                            <span className="ml-2">
                              &middot; Approved by {draft.approved_by}
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={saveEditing}
                                disabled={isSaving}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#FFA500] text-[#1a1a1a] font-medium rounded hover:bg-[#FFD700] transition-colors disabled:opacity-50"
                              >
                                <Save className="w-3 h-3" />
                                {isSaving ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#333] text-gray-300 rounded hover:bg-[#444] transition-colors"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEditing(draft)}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#333] text-gray-300 rounded hover:bg-[#444] transition-colors"
                              >
                                <Edit2 className="w-3 h-3" />
                                Edit
                              </button>
                              {draft.is_edited && (
                                <button
                                  onClick={() => handleReset(draft.id)}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#333] text-gray-300 rounded hover:bg-[#444] transition-colors"
                                  title="Reset to AI Original"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  Reset
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Articles */}
                      <div className="space-y-4">
                        {summariesToShow.map((item, idx) => (
                          <div
                            key={idx}
                            className="bg-[#1a1a1a] rounded-lg p-4 border border-[#333]"
                          >
                            <div className="flex items-start gap-2">
                              <div className="flex-1">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={item.title}
                                    onChange={(e) => updateTitle(idx, e.target.value)}
                                    className="w-full bg-[#252525] border border-[#444] rounded px-3 py-1.5 text-white text-sm font-medium mb-2 focus:outline-none focus:border-[#FFA500]"
                                  />
                                ) : (
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-medium text-[#FFA500] hover:text-[#FFD700] transition-colors"
                                  >
                                    {item.title}
                                  </a>
                                )}
                              </div>
                              {isEditing && (
                                <button
                                  onClick={() => deleteArticle(idx)}
                                  className="p-1.5 rounded bg-red-600/20 text-red-400 hover:bg-red-600/40 transition-colors flex-shrink-0"
                                  title="Delete article"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            {isEditing ? (
                              <div className="mt-1 mb-2">
                                <input
                                  type="text"
                                  value={item.url}
                                  onChange={(e) => updateUrl(idx, e.target.value)}
                                  placeholder="Article URL"
                                  className="w-full bg-[#252525] border border-[#444] rounded px-3 py-1.5 text-gray-400 text-xs focus:outline-none focus:border-[#FFA500]"
                                />
                              </div>
                            ) : (
                              <div className="text-xs text-gray-500 mt-1 mb-2">
                                {item.source}
                              </div>
                            )}

                            {/* Bullets */}
                            {item.bullets && item.bullets.length > 0 ? (
                              <div>
                                <ul className="space-y-2">
                                  {item.bullets.map((bullet, bIdx) => (
                                    <li key={bIdx}>
                                      {isEditing ? (
                                        <div className="flex items-start gap-2">
                                          <textarea
                                            value={bullet}
                                            onChange={(e) =>
                                              updateBullet(idx, bIdx, e.target.value)
                                            }
                                            rows={2}
                                            className="flex-1 bg-[#252525] border border-[#444] rounded px-3 py-1.5 text-gray-300 text-sm resize-none focus:outline-none focus:border-[#FFA500]"
                                          />
                                          <button
                                            onClick={() => deleteBullet(idx, bIdx)}
                                            className="p-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/40 transition-colors flex-shrink-0 mt-1"
                                            title="Delete bullet"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        </div>
                                      ) : (
                                        <p className="text-sm text-gray-300 pl-3 border-l-2 border-[#444]">
                                          {bullet}
                                        </p>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                                {isEditing && (
                                  <button
                                    onClick={() => addBullet(idx)}
                                    className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-[#FFA500] transition-colors"
                                  >
                                    <Plus className="w-3 h-3" />
                                    Add bullet
                                  </button>
                                )}
                              </div>
                            ) : (
                              // Summary text fallback
                              isEditing ? (
                                <textarea
                                  value={item.summary}
                                  onChange={(e) =>
                                    updateSummaryText(idx, e.target.value)
                                  }
                                  rows={3}
                                  className="w-full bg-[#252525] border border-[#444] rounded px-3 py-1.5 text-gray-300 text-sm resize-none focus:outline-none focus:border-[#FFA500]"
                                />
                              ) : (
                                <p className="text-sm text-gray-300">
                                  {item.summary}
                                </p>
                              )
                            )}
                          </div>
                        ))}

                        {/* Add Article button */}
                        {isEditing && (
                          <button
                            onClick={addArticle}
                            className="w-full py-3 border border-dashed border-[#444] rounded-lg text-sm text-gray-400 hover:text-[#FFA500] hover:border-[#FFA500] transition-colors flex items-center justify-center gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            Add Article
                          </button>
                        )}
                      </div>

                      {/* Internal Notes */}
                      <div className="mt-4 pt-4 border-t border-[#333]">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="w-3 h-3 text-gray-500" />
                          <span className="text-xs text-gray-500">Internal Note</span>
                        </div>
                        {noteEditId === draft.id ? (
                          <div className="flex gap-2">
                            <textarea
                              value={noteText}
                              onChange={(e) => setNoteText(e.target.value)}
                              rows={2}
                              className="flex-1 bg-[#1a1a1a] border border-[#444] rounded px-3 py-1.5 text-gray-300 text-sm resize-none focus:outline-none focus:border-[#FFA500]"
                              placeholder="Add a note..."
                            />
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => handleSaveNote(draft.id)}
                                className="px-2 py-1 text-xs bg-[#FFA500] text-[#1a1a1a] rounded hover:bg-[#FFD700]"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setNoteEditId(null)}
                                className="px-2 py-1 text-xs bg-[#333] text-gray-300 rounded hover:bg-[#444]"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => {
                              setNoteEditId(draft.id);
                              setNoteText(draft.internal_note || '');
                            }}
                            className="text-sm text-gray-400 cursor-pointer hover:text-gray-300 p-2 rounded border border-transparent hover:border-[#444] transition-colors min-h-[32px]"
                          >
                            {draft.internal_note || 'Click to add note...'}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
