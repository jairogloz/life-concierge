import { useEffect, useState, useCallback } from 'react';
import { useApi } from '../lib/useApi';
import Spinner from '../components/Spinner';
import type { AISuggestion, TaskType } from '../types';

const IMPACT_OPTS = [1,2,3,4,5].map(n => ({
  v: n, l: `${n} – ${['Very Low','Low','Medium','High','Very High'][n-1]}`,
}));

const TASK_TYPE_OPTS: { v: TaskType; l: string }[] = [
  { v: 'one_time', l: 'One-time' },
  { v: 'daily',    l: 'Daily' },
];

interface EditState {
  title: string;
  description: string;
  task_type: TaskType;
  impact: number;
  context_tags: string;
}

function toEditState(s: AISuggestion): EditState {
  return {
    title: s.suggestion.title,
    description: s.suggestion.description ?? '',
    task_type: (s.suggestion.task_type as TaskType) || 'one_time',
    impact: s.suggestion.impact || 3,
    context_tags: (s.suggestion.context_tags ?? []).join(', '),
  };
}

export default function Inbox() {
  const api = useApi();
  const [rawText, setRawText]     = useState('');
  const [pending, setPending]     = useState<AISuggestion[]>([]);
  const [loading, setLoading]     = useState(true);
  const [processing, setProcessing] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);
  // editingId → open edit form; null = collapsed view
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm]   = useState<EditState | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: AISuggestion[] }>('/tasks/inbox');
      setPending(res.data.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  async function capture() {
    if (!rawText.trim()) return;
    setProcessing(true);
    try {
      await api.post('/tasks/inbox', { raw_text: rawText.trim() });
      setRawText('');
      await load();
    } finally {
      setProcessing(false);
    }
  }

  function openEdit(s: AISuggestion) {
    setEditingId(s.id);
    setEditForm(toEditState(s));
  }

  function closeEdit() { setEditingId(null); setEditForm(null); }

  async function accept(id: string, overrides?: object) {
    setActioning(id);
    try {
      await api.post(`/tasks/inbox/${id}/accept`, overrides ?? {});
      closeEdit();
      await load();
    } finally {
      setActioning(null);
    }
  }

  async function saveAndAccept(id: string) {
    if (!editForm) return;
    const overrides = {
      title: editForm.title,
      description: editForm.description,
      task_type: editForm.task_type,
      impact: editForm.impact,
      context_tags: editForm.context_tags.split(',').map(s => s.trim()).filter(Boolean),
    };
    await accept(id, overrides);
  }

  async function reject(id: string) {
    setActioning(id);
    try {
      await api.post(`/tasks/inbox/${id}/reject`);
      closeEdit();
      await load();
    } finally {
      setActioning(null);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Quick Capture</h1>
        <p className="text-sm text-gray-500 mt-0.5">Drop a thought — AI will structure it into a task.</p>
      </div>

      {/* Capture box */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-8">
        <textarea rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          placeholder="e.g. Call mom this Sunday, important for family role"
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) capture(); }}
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-400">⌘ + Enter to send</span>
          <button onClick={capture} disabled={processing || !rawText.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors flex items-center gap-1.5">
            {processing ? (
              <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Analysing…</>
            ) : '✨ Capture'}
          </button>
        </div>
      </div>

      {/* Pending suggestions */}
      {loading ? <Spinner /> : pending.length === 0 ? (
        <p className="text-center text-gray-400 py-12">No pending suggestions — capture something above!</p>
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Pending ({pending.length})</h2>
          {pending.map(s => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-400 mb-2 italic">"{s.raw_text}"</p>

              {editingId === s.id && editForm ? (
                /* ── Edit-in-place form ───────────────────────────────── */
                <div className="space-y-3">
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="Title" value={editForm.title}
                    onChange={e => setEditForm(p => p && ({ ...p, title: e.target.value }))} />
                  <textarea rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                    placeholder="Description" value={editForm.description}
                    onChange={e => setEditForm(p => p && ({ ...p, description: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Type</label>
                      <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        value={editForm.task_type}
                        onChange={e => setEditForm(p => p && ({ ...p, task_type: e.target.value as TaskType }))}>
                        {TASK_TYPE_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Impact</label>
                      <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        value={editForm.impact}
                        onChange={e => setEditForm(p => p && ({ ...p, impact: Number(e.target.value) }))}>
                        {IMPACT_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                    </div>
                  </div>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="Tags (comma-separated)" value={editForm.context_tags}
                    onChange={e => setEditForm(p => p && ({ ...p, context_tags: e.target.value }))} />
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => saveAndAccept(s.id)} disabled={actioning === s.id}
                      className="flex-1 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-40 transition-colors">
                      {actioning === s.id ? 'Working…' : '✅ Save & Accept'}
                    </button>
                    <button onClick={() => reject(s.id)} disabled={actioning === s.id}
                      className="py-1.5 px-4 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-40 transition-colors">
                      ✕ Reject
                    </button>
                    <button onClick={closeEdit}
                      className="py-1.5 px-3 text-gray-400 text-sm hover:text-gray-600 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Read-only view ───────────────────────────────────── */
                <>
                  <div className="space-y-1 mb-3">
                    <p className="font-semibold text-gray-900">{s.suggestion.title}</p>
                    {s.suggestion.description && (
                      <p className="text-sm text-gray-500">{s.suggestion.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 capitalize">
                        {s.suggestion.task_type || 'one_time'}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">
                        impact {s.suggestion.impact || '—'}
                      </span>
                      {s.suggestion.deadline_hint && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                          {s.suggestion.deadline_hint}
                        </span>
                      )}
                      {(s.suggestion.context_tags ?? []).map(tag => (
                        <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">#{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => accept(s.id)} disabled={actioning === s.id}
                      className="flex-1 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-40 transition-colors">
                      {actioning === s.id ? 'Working…' : '✅ Accept'}
                    </button>
                    <button onClick={() => openEdit(s)} disabled={actioning === s.id}
                      className="px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 disabled:opacity-40 transition-colors">
                      ✏️ Edit
                    </button>
                    <button onClick={() => reject(s.id)} disabled={actioning === s.id}
                      className="flex-1 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-40 transition-colors">
                      ✕ Reject
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
