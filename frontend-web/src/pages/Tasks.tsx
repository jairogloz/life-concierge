import { useEffect, useState, useCallback } from 'react';
import { useApi } from '../lib/useApi';
import Spinner from '../components/Spinner';
import type { Task, Role, Goal, CommitmentType } from '../types';

const COMMITMENT_TYPES: CommitmentType[] = ['commitment', 'habit', 'recurring', 'intention'];
const EMPTY_FORM = {
  title: '', description: '', primary_role_id: '', goal_id: '',
  commitment_type: 'intention' as CommitmentType, urgency: 5, context_tags: '',
};

export default function Tasks() {
  const api = useApi();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ role_id: '', goal_id: '', status: '' });
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.role_id) params.set('role_id', filter.role_id);
      if (filter.goal_id) params.set('goal_id', filter.goal_id);
      if (filter.status)  params.set('status', filter.status);
      const [tRes, rRes, gRes] = await Promise.all([
        api.get<{ data: Task[] }>(`/tasks?${params}`),
        api.get<{ data: Role[] }>('/roles'),
        api.get<{ data: Goal[] }>('/goals'),
      ]);
      setTasks(tRes.data.data ?? []);
      setRoles(rRes.data.data ?? []);
      setGoals(gRes.data.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [api, filter]);

  useEffect(() => { load(); }, [load]);

  function startEdit(t: Task) {
    setEditing(t.id);
    setForm({
      title: t.title, description: t.description,
      primary_role_id: t.primary_role_id, goal_id: t.goal_id ?? '',
      commitment_type: t.commitment_type, urgency: t.urgency,
      context_tags: (t.context_tags ?? []).join(', '),
    });
    setShowForm(true);
  }

  function cancelEdit() { setEditing(null); setForm(EMPTY_FORM); setShowForm(false); }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        goal_id: form.goal_id || null,
        context_tags: form.context_tags.split(',').map(s => s.trim()).filter(Boolean),
      };
      if (editing) {
        await api.put(`/tasks/${editing}`, payload);
      } else {
        await api.post('/tasks', payload);
      }
      cancelEdit();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function complete(id: string) {
    await api.patch(`/tasks/${id}/complete`);
    await load();
  }

  async function remove(id: string) {
    if (!confirm('Delete this task?')) return;
    await api.delete(`/tasks/${id}`);
    await load();
  }

  function statusBadge(status: string) {
    const map: Record<string, string> = {
      active: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      paused: 'bg-yellow-100 text-yellow-700',
    };
    return `text-xs px-2 py-0.5 rounded-full font-medium capitalize ${map[status] ?? 'bg-gray-100 text-gray-600'}`;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
        <button onClick={() => { setShowForm(v => !v); if (editing) cancelEdit(); }}
          className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          {showForm ? 'Cancel' : '+ New Task'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        {([
          ['role_id', roles.map(r => ({ v: r.id, l: r.name })), 'All roles'],
          ['goal_id', goals.map(g => ({ v: g.id, l: g.title })), 'All goals'],
          ['status', [{ v: 'active', l: 'Active' }, { v: 'completed', l: 'Completed' }], 'Any status'],
        ] as [string, { v: string; l: string }[], string][]).map(([key, opts, placeholder]) => (
          <select key={key}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={filter[key as keyof typeof filter]}
            onChange={e => setFilter(p => ({ ...p, [key]: e.target.value }))}
          >
            <option value="">{placeholder}</option>
            {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">{editing ? 'Edit Task' : 'New Task'}</h2>
          <div className="grid grid-cols-2 gap-3">
            <input className="col-span-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="Title" value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            <textarea className="col-span-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              rows={2} placeholder="Description (optional)" value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.primary_role_id}
              onChange={e => setForm(p => ({ ...p, primary_role_id: e.target.value }))}>
              <option value="">Role…</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.goal_id}
              onChange={e => setForm(p => ({ ...p, goal_id: e.target.value }))}>
              <option value="">Goal (optional)</option>
              {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
            <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.commitment_type}
              onChange={e => setForm(p => ({ ...p, commitment_type: e.target.value as CommitmentType }))}>
              {COMMITMENT_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="Tags (comma separated)" value={form.context_tags}
              onChange={e => setForm(p => ({ ...p, context_tags: e.target.value }))} />
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Urgency: <strong>{form.urgency}</strong></label>
              <input type="range" min={1} max={10} className="w-full accent-indigo-600"
                value={form.urgency}
                onChange={e => setForm(p => ({ ...p, urgency: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={save} disabled={saving || !form.title || !form.primary_role_id}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors">
              {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
            </button>
            <button onClick={cancelEdit}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? <Spinner /> : (
        <ul className="space-y-3">
          {tasks.map(t => (
            <li key={t.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
              <div className="flex items-start gap-3">
                <button onClick={() => complete(t.id)}
                  disabled={t.status === 'completed'}
                  className="mt-1 w-5 h-5 rounded-full border-2 border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 transition-colors disabled:opacity-30 shrink-0"
                  title="Mark complete" />
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-gray-900 ${t.status === 'completed' ? 'line-through text-gray-400' : ''}`}>
                    {t.title}
                  </p>
                  {t.description && (
                    <p className="text-sm text-gray-500 mt-0.5 truncate">{t.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className={statusBadge(t.status)}>{t.status}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">{t.commitment_type}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">u:{t.urgency}</span>
                    {(t.context_tags ?? []).map(tag => (
                      <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">#{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => startEdit(t)}
                    className="text-xs px-2 py-1 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
                    Edit
                  </button>
                  <button onClick={() => remove(t.id)}
                    className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
          {tasks.length === 0 && !loading && (
            <p className="text-center text-gray-400 py-12">No tasks yet — create one above or use Quick Capture.</p>
          )}
        </ul>
      )}
    </div>
  );
}
