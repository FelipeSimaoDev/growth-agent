'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function DashboardPage() {
  const [pending, setPending] = useState(null);
  const [posts, setPosts] = useState([]);
  const [todayInput, setTodayInput] = useState('');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  async function load() {
    try {
      setLoading(true);
      const [pendingRes, postsRes, inputRes] = await Promise.all([
        api.getPendingPost(),
        api.getPosts(),
        api.getTodayInput(),
      ]);
      setPending(pendingRes.data);
      setPosts(postsRes.data || []);
      if (inputRes.data?.what_was_built) {
        setTodayInput(inputRes.data.what_was_built);
        setInputText(inputRes.data.what_was_built);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function flash(msg) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  }

  async function handleSaveInput() {
    try {
      setActionLoading(true);
      await api.saveTodayInput(inputText);
      setTodayInput(inputText);
      flash('Daily input saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleGenerate() {
    try {
      setActionLoading(true);
      setError(null);
      const res = await api.generatePost();
      setPending(res.data);
      flash('Post generated and sent to Telegram!');
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleMarkPosted() {
    if (!pending) return;
    try {
      setActionLoading(true);
      setError(null);
      await api.markPosted(pending.id);
      flash('Marked as posted.');
      setPending(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRegenerate() {
    if (!pending) return;
    try {
      setActionLoading(true);
      setError(null);
      const res = await api.regeneratePost(pending.id);
      setPending(res.data);
      flash('Post regenerated!');
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  const statusBadge = (status) => {
    const map = {
      PENDING: 'bg-yellow-500/20 text-yellow-300',
      POSTED: 'bg-green-500/20 text-green-300',
    };
    return (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] || 'bg-gray-800 text-gray-400'}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return <p className="text-gray-500 text-sm">Loading...</p>;
  }

  return (
    <div className="space-y-8">
      {/* Alerts */}
      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="bg-green-900/40 border border-green-700 text-green-300 rounded-lg px-4 py-3 text-sm">
          {successMsg}
        </div>
      )}

      {/* Daily Input */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          What did you build today?
        </h2>
        <textarea
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none"
          rows={3}
          placeholder="Optional — describe what you shipped, learned, or worked on today..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={handleSaveInput}
            disabled={actionLoading}
            className="text-sm bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            Save input
          </button>
          {todayInput && (
            <span className="text-xs text-gray-500">Saved for today</span>
          )}
        </div>
      </section>

      {/* Pending Post */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Pending Post
          </h2>
          {!pending && (
            <button
              onClick={handleGenerate}
              disabled={actionLoading}
              className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              Generate now
            </button>
          )}
        </div>

        {pending ? (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              {statusBadge(pending.status)}
              <span className="text-xs text-gray-500">
                Generated {new Date(pending.created_at).toLocaleTimeString()}
              </span>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">Content</p>
              <p className="text-gray-200 text-sm whitespace-pre-wrap leading-relaxed font-mono bg-gray-950 rounded-lg px-4 py-3">
                {pending.content}
              </p>
            </div>

            <p className="text-xs text-gray-600">
              Use the Telegram buttons to act, or use the buttons below.
            </p>

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleMarkPosted}
                disabled={actionLoading}
                className="flex-1 bg-green-700 hover:bg-green-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                ✅ Mark as Posted
              </button>
              <button
                onClick={handleRegenerate}
                disabled={actionLoading}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                🔁 Regenerate
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 border-dashed rounded-xl p-8 text-center">
            <p className="text-gray-500 text-sm">No pending post.</p>
            <p className="text-gray-600 text-xs mt-1">
              The cron job runs daily at 9 AM UTC, or generate manually above.
            </p>
          </div>
        )}
      </section>

      {/* Recent Posts */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Recent Posts
        </h2>
        <div className="space-y-3">
          {posts
            .filter((p) => p.status !== 'PENDING')
            .slice(0, 10)
            .map((post) => (
              <div
                key={post.id}
                className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  {statusBadge(post.status)}
                  {post.posted_at && (
                    <span className="text-xs text-gray-500">
                      {new Date(post.posted_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed line-clamp-3">
                  {post.content}
                </p>
              </div>
            ))}
          {posts.filter((p) => p.status !== 'PENDING').length === 0 && (
            <p className="text-gray-600 text-sm">No posts yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
