import { useEffect, useState, useCallback } from 'react';
import { useApi } from '../lib/useApi';
import type { WishlistItem, WishlistVerdict, Role, Goal } from '../types';

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);

const VERDICT_CONFIG: Record<WishlistVerdict, { label: string; color: string; bg: string }> = {
  buy_now: { label: '✅ Buy Now',  color: 'text-green-700',  bg: 'bg-green-100'  },
  wait:    { label: '⏳ Wait',     color: 'text-yellow-700', bg: 'bg-yellow-100' },
  reject:  { label: '❌ Reject',   color: 'text-red-700',    bg: 'bg-red-100'    },
  replace: { label: '🔄 Replace',  color: 'text-blue-700',   bg: 'bg-blue-100'   },
};

const EMPTY_FORM = {
  title: '',
  price: '',
  currency: 'USD',
  role_id: '',
  goal_id: '',
  importance: '5',
  cooldown_days: '30',
};

// ── component ─────────────────────────────────────────────────────────────────

export default function Wishlist() {
  const api = useApi();
  const [items, setItems]   = useState<WishlistItem[]>([]);
  const [roles, setRoles]   = useState<Role[]>([]);
  const [goals, setGoals]   = useState<Goal[]>([]);
  const [loading, setLoading]   = useState(true);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [wRes, rRes, gRes] = await Promise.all([
        api.get<{ data: WishlistItem[] }>('/wishlist'),
        api.get<{ data: Role[] }>('/roles'),
        api.get<{ data: Goal[] }>('/goals'),
      ]);
      setItems(wRes.data.data ?? []);
      setRoles(rRes.data.data ?? []);
      setGoals(gRes.data.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Failed to load wishlist data.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  // ── create ────────────────────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/wishlist', {
        title:        form.title,
        price:        parseFloat(form.price) || 0,
        currency:     form.currency,
        role_id:      form.role_id  || null,
        goal_id:      form.goal_id  || null,
        importance:   parseInt(form.importance) || 5,
        cooldown_days: parseInt(form.cooldown_days) || 30,
      });
      setForm(EMPTY_FORM);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Failed to add item.');
    } finally {
      setSaving(false);
    }
  }

  // ── evaluate ──────────────────────────────────────────────────────────────

  async function handleEvaluate(itemId: string) {
    setEvaluatingId(itemId);
    try {
      const res = await api.post<WishlistItem>(`/wishlist/${itemId}/evaluate`, {});
      setItems(prev => prev.map(i => i.id === itemId ? res.data : i));
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? 'Evaluation failed.');
    } finally {
      setEvaluatingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900">🛒 Wishlist</h1>

      {/* ── Add item form ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Add Item</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Noise-cancelling headphones"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
            <input
              type="number" min="0" step="0.01"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="0.00"
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
              maxLength={3} placeholder="USD"
              value={form.currency}
              onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role (optional)</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.role_id}
              onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))}
            >
              <option value="">— none —</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Goal (optional)</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.goal_id}
              onChange={e => setForm(f => ({ ...f, goal_id: e.target.value }))}
            >
              <option value="">— none —</option>
              {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Importance (1–10)</label>
            <input
              type="number" min="1" max="10"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.importance}
              onChange={e => setForm(f => ({ ...f, importance: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cooldown (days)</label>
            <input
              type="number" min="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.cooldown_days}
              onChange={e => setForm(f => ({ ...f, cooldown_days: e.target.value }))}
            />
          </div>

          {error && (
            <p className="sm:col-span-2 text-sm text-red-600">{error}</p>
          )}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50"
            >
              {saving ? 'Adding…' : '+ Add to Wishlist'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Item list ─────────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <p className="text-center text-gray-400 text-sm">Your wishlist is empty. Add an item above.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map(item => {
            const vc = item.verdict ? VERDICT_CONFIG[item.verdict] : null;
            const isEvaluating = evaluatingId === item.id;
            return (
              <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{item.title}</h3>
                    <p className="text-indigo-600 font-bold text-lg mt-0.5">
                      {fmt(item.price, item.currency)}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-gray-500">Importance: {item.importance}/10</span>
                      {item.roi_score != null && (
                        <span className="text-xs text-gray-500">ROI: {item.roi_score}/10</span>
                      )}
                      {item.emotional_score != null && (
                        <span className="text-xs text-gray-500">Emotional: {item.emotional_score}/10</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {vc && (
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${vc.bg} ${vc.color}`}>
                        {vc.label}
                      </span>
                    )}
                    <button
                      onClick={() => handleEvaluate(item.id)}
                      disabled={isEvaluating}
                      className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-50"
                    >
                      {isEvaluating ? 'Thinking…' : '🤖 Ask AI'}
                    </button>
                  </div>
                </div>

                {item.verdict_reasoning && (
                  <p className="mt-3 text-sm text-gray-600 border-t border-gray-100 pt-3 italic">
                    "{item.verdict_reasoning}"
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
