import { useEffect, useState, useCallback } from 'react';
import { useApi } from '../lib/useApi';
import Spinner from '../components/Spinner';
import type { AISuggestion } from '../types';

export default function Inbox() {
  const api = useApi();
  const [rawText, setRawText] = useState('');
  const [pending, setPending] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);

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

  async function accept(id: string) {
    setActioning(id);
    try {
      await api.post(`/tasks/inbox/${id}/accept`);
      await load();
    } finally {
      setActioning(null);
    }
  }

  async function reject(id: string) {
    setActioning(id);
    try {
      await api.post(`/tasks/inbox/${id}/reject`);
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
        <textarea
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          placeholder="e.g. Call mom this Sunday, important for family role"
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) capture(); }}
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-400">⌘ + Enter to send</span>
          <button
            onClick={capture}
            disabled={processing || !rawText.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors flex items-center gap-1.5"
          >
            {processing ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Analysing…
              </>
            ) : '✨ Capture'}
          </button>
        </div>
      </div>

      {/* Pending suggestions */}
      {loading ? <Spinner /> : pending.length === 0 ? (
        <p className="text-center text-gray-400 py-12">No pending suggestions — capture something above!</p>
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
            Pending ({pending.length})
          </h2>
          {pending.map(s => (
            <div key={s.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-400 mb-2 italic">"{s.raw_text}"</p>
              <div className="space-y-1 mb-3">
                <p className="font-semibold text-gray-900">{s.suggestion.title}</p>
                {s.suggestion.description && (
                  <p className="text-sm text-gray-500">{s.suggestion.description}</p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 capitalize">
                    {s.suggestion.commitment_type}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">
                    urgency {s.suggestion.urgency}
                  </span>
                  {s.suggestion.deadline_hint && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                      {s.suggestion.deadline_hint}
                    </span>
                  )}
                  {(s.suggestion.context_tags ?? []).map(tag => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => accept(s.id)}
                  disabled={actioning === s.id}
                  className="flex-1 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-40 transition-colors"
                >
                  {actioning === s.id ? 'Working…' : '✅ Accept'}
                </button>
                <button
                  onClick={() => reject(s.id)}
                  disabled={actioning === s.id}
                  className="flex-1 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-40 transition-colors"
                >
                  ✕ Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
