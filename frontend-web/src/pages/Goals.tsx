import { useEffect, useState, useCallback } from 'react';
import { useApi } from '../lib/useApi';
import Spinner from '../components/Spinner';
import type { Goal, Role } from '../types';

const EMPTY_FORM = { title: '', description: '', role_id: '', urgency: 5 };

export default function Goals() {
  const api = useApi();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRoleId, setFilterRoleId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [gRes, rRes] = await Promise.all([
        filterRoleId
          ? api.get<{ data: Goal[] }>(`/roles/${filterRoleId}/goals`)
          : api.get<{ data: Goal[] }>('/goals'),
        api.get<{ data: Role[] }>('/roles'),
      ]);
      setGoals(gRes.data.data ?? []);
      setRoles(rRes.data.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [api, filterRoleId]);

  useEffect(() => { load(); }, [load]);

  function startEdit(g: Goal) {
    setEditing(g.id);
    setForm({ title: g.title, description: g.description, role_id: g.role_id, urgency: g.urgency });
  }

  function cancelEdit() { setEditing(null); setForm(EMPTY_FORM); }

  async function save() {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/goals/${editing}`, form);
      } else {
        await api.post('/goals', form);
      }
      cancelEdit();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this goal?')) return;
    await api.delete(`/goals/${id}`);
    await load();
  }

  function statusBadge(status: string) {
    const map: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      completed: 'bg-gray-100 text-gray-500',
      paused: 'bg-yellow-100 text-yellow-700',
    };
    return map[status] ?? 'bg-gray-100 text-gray-600';
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Goals</h1>

      {/* Filter */}
      <select
        className="mb-5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        value={filterRoleId}
        onChange={e => setFilterRoleId(e.target.value)}
      >
        <option value="">All roles</option>
        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>

      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">{editing ? 'Edit Goal' : 'New Goal'}</h2>
        <div className="space-y-3">
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Title"
            value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
          />
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            rows={2} placeholder="Description (optional)"
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          />
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            value={form.role_id}
            onChange={e => setForm(p => ({ ...p, role_id: e.target.value }))}
          >
            <option value="">Select role…</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Urgency: <strong>{form.urgency}</strong></label>
            <input type="range" min={1} max={10}
              className="w-full accent-indigo-600"
              value={form.urgency}
              onChange={e => setForm(p => ({ ...p, urgency: Number(e.target.value) }))}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={save} disabled={saving || !form.title || !form.role_id}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors">
            {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
          </button>
          {editing && (
            <button onClick={cancelEdit}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {loading ? <Spinner /> : (
        <ul className="space-y-3">
          {goals.map(g => (
            <li key={g.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{g.title}</p>
                  {g.description && <p className="text-sm text-gray-500 mt-0.5 truncate">{g.description}</p>}
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusBadge(g.status)}`}>
                      {g.status}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                      urgency {g.urgency}
                    </span>
                    {g.deadline && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                        due {new Date(g.deadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => startEdit(g)}
                    className="text-xs px-2 py-1 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
                    Edit
                  </button>
                  <button onClick={() => remove(g.id)}
                    className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
          {goals.length === 0 && (
            <p className="text-center text-gray-400 py-12">No goals yet — create one above.</p>
          )}
        </ul>
      )}
    </div>
  );
}
