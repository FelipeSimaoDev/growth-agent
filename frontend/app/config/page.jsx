'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const defaultConfig = {
  app_name: '',
  description: '',
  target_audience: '',
  tone_of_voice: '',
  subreddits: [],
  context_blocks: [],
  growth_focus_type: 'BUILD_IN_PUBLIC',
  growth_focus_description: '',
  writing_samples: '',
};

export default function ConfigPage() {
  const [form, setForm] = useState(defaultConfig);
  const [subredditInput, setSubredditInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getConfig().then((res) => {
      if (res.data) {
        setForm(res.data);
      }
      setLoading(false);
    }).catch((err) => {
      setError(err.message);
      setLoading(false);
    });
  }, []);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addSubreddit() {
    const val = subredditInput.trim().replace(/^r\//, '');
    if (!val) return;
    if (form.subreddits.includes(val)) return;
    set('subreddits', [...form.subreddits, val]);
    setSubredditInput('');
  }

  function removeSubreddit(sub) {
    set('subreddits', form.subreddits.filter((s) => s !== sub));
  }

  function addContextBlock() {
    set('context_blocks', [...form.context_blocks, { title: '', content: '' }]);
  }

  function updateBlock(i, key, value) {
    const blocks = [...form.context_blocks];
    blocks[i] = { ...blocks[i], [key]: value };
    set('context_blocks', blocks);
  }

  function removeBlock(i) {
    set('context_blocks', form.context_blocks.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      await api.updateConfig(form);
      setSuccessMsg('Config saved!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-gray-500 text-sm">Loading...</p>;

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold text-white">App Config</h1>

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

      {/* Basic Fields */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Product Info
        </h2>
        {[
          { label: 'App Name', key: 'app_name', placeholder: 'MyApp' },
          { label: 'Description', key: 'description', placeholder: 'One sentence about what it does', textarea: true },
          { label: 'Target Audience', key: 'target_audience', placeholder: 'e.g. indie hackers, solo founders' },
          { label: 'Tone of Voice', key: 'tone_of_voice', placeholder: 'e.g. honest, self-aware, direct' },
        ].map(({ label, key, placeholder, textarea }) => (
          <div key={key}>
            <label className="block text-xs text-gray-400 mb-1">{label}</label>
            {textarea ? (
              <textarea
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none"
                rows={3}
                placeholder={placeholder}
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
              />
            ) : (
              <input
                type="text"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500"
                placeholder={placeholder}
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
              />
            )}
          </div>
        ))}
      </section>

      {/* Subreddits */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Target Subreddits
        </h2>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500"
            placeholder="SaaS or r/SaaS"
            value={subredditInput}
            onChange={(e) => setSubredditInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSubreddit()}
          />
          <button
            onClick={addSubreddit}
            className="bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm px-4 rounded-lg transition-colors"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {form.subreddits.map((sub) => (
            <span
              key={sub}
              className="flex items-center gap-1.5 bg-gray-800 text-gray-300 text-sm px-3 py-1 rounded-full"
            >
              r/{sub}
              <button
                onClick={() => removeSubreddit(sub)}
                className="text-gray-500 hover:text-red-400 transition-colors"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </section>

      {/* Context Blocks */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Context Blocks
          </h2>
          <button
            onClick={addContextBlock}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            + Add block
          </button>
        </div>
        <p className="text-xs text-gray-600 mb-4">
          Long-form context fed to the AI — add anything relevant: origin story, features, past
          learnings, positioning.
        </p>
        <div className="space-y-4">
          {form.context_blocks.map((block, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  className="bg-transparent border-b border-gray-700 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 pb-1"
                  placeholder="Block title (e.g. Origin Story)"
                  value={block.title}
                  onChange={(e) => updateBlock(i, 'title', e.target.value)}
                />
                <button
                  onClick={() => removeBlock(i)}
                  className="text-gray-600 hover:text-red-400 text-xs transition-colors ml-4"
                >
                  Remove
                </button>
              </div>
              <textarea
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-700 resize-none"
                rows={5}
                placeholder="Write anything about your product, story, learnings..."
                value={block.content}
                onChange={(e) => updateBlock(i, 'content', e.target.value)}
              />
            </div>
          ))}
          {form.context_blocks.length === 0 && (
            <p className="text-gray-600 text-sm">No context blocks yet. Add one above.</p>
          )}
        </div>
      </section>

      {/* Growth Focus */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Growth Focus
        </h2>
        {form.growth_focus_type ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-4 space-y-1">
            <p className="text-xs text-gray-500">Active focus</p>
            <p className="text-white font-medium">{form.growth_focus_type.replace(/_/g, ' ')}</p>
            {form.growth_focus_description && (
              <p className="text-gray-400 text-sm">{form.growth_focus_description}</p>
            )}
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-4">
            <p className="text-gray-500 text-sm">No focus set — defaulting to Build in Public.</p>
          </div>
        )}
        <p className="text-xs text-gray-600 mt-2">
          Change the active focus by sending <code className="text-gray-500">/focus</code> to your Telegram bot.
        </p>
      </section>

      {/* Writing Voice */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          My Voice
        </h2>
        <p className="text-xs text-gray-600 mb-4">
          Paste real examples of how you write — tweets, messages, previous posts, anything. Separate
          each example with <code className="text-gray-500">---</code>. The AI will study these and
          write in your exact voice.
        </p>
        <textarea
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none font-mono"
          rows={12}
          placeholder={`Example 1: an old tweet or post you wrote\n\n---\n\nExample 2: a message you sent to someone about the product\n\n---\n\nExample 3: how you explained your idea to a friend`}
          value={form.writing_samples || ''}
          onChange={(e) => set('writing_samples', e.target.value)}
        />
      </section>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-3 rounded-xl transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Config'}
      </button>
    </div>
  );
}
