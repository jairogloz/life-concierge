import { useEffect, useState, useCallback, useRef } from 'react';
import { useApi } from '../lib/useApi';
import Spinner from '../components/Spinner';
import type { Task, Role, Goal, TaskType } from '../types';

const TASK_TYPES: { v: TaskType; l: string }[] = [
  { v: 'one_time', l: 'One-time' },
  { v: 'daily',    l: 'Daily' },
];

const IMPACT_OPTS = [1,2,3,4,5].map(n => ({
  v: n,
  l: `${n} – ${['Very Low','Low','Medium','High','Very High'][n-1]}`,
}));

const EFFORT_OPTS = IMPACT_OPTS; // same scale

const EMPTY_FORM = {
  title: '', description: '', primary_role_id: '', goal_id: '',
  task_type: 'one_time' as TaskType,
  impact: 3, effort: 3, estimated_minutes: '',
  scheduled_date: '', soft_deadline: '', deadline: '',
  context_tags: '',
};

export default function Tasks() {
  const api = useApi();
  const [tasks, setTasks]   = useState<Task[]>([]);
  const [roles, setRoles]   = useState<Role[]>([]);
  const [goals, setGoals]   = useState<Goal[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState({ role_id: '', goal_id: '', status: '' });
  const [form, setForm]       = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]   = useState(false);

  // Tag autocomplete state
  const [tagInput, setTagInput]   = useState('');
  const [tagSugs, setTagSugs]     = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const tagRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.role_id) params.set('role_id', filter.role_id);
      if (filter.goal_id) params.set('goal_id', filter.goal_id);
      if (filter.status)  params.set('status', filter.status);
      const [tRes, rRes, gRes, tagsRes] = await Promise.all([
        api.get<{ data: Task[] }>(`/tasks?${params}`),
        api.get<{ data: Role[] }>('/roles'),
        api.get<{ data: Goal[] }>('/goals'),
        api.get<{ data: string[] }>('/tasks/tags'),
      ]);
      setTasks(tRes.data.data ?? []);
      setRoles(rRes.data.data ?? []);
      setGoals(gRes.data.data ?? []);
      setAllTags(tagsRes.data.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [api, filter]);

  useEffect(() => { load(); }, [load]);

  // Tag input helpers
  function handleTagInput(val: string) {
    setTagInput(val);
    if (val.trim()) {
      const q = val.trim().toLowerCase();
      setTagSugs(allTags.filter(t => t.toLowerCase().includes(q) && !selectedTags.includes(t)));
    } else {
      setTagSugs([]);
    }
  }

  function addTag(tag: string) {
    const t = tag.trim();
    if (t && !selectedTags.includes(t)) setSelectedTags(p => [...p, t]);
    setTagInput('');
    setTagSugs([]);
  }

  function removeTag(tag: string) { setSelectedTags(p => p.filter(t => t !== tag)); }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput);
    }
    if (e.key === 'Backspace' && !tagInput && selectedTags.length) {
      setSelectedTags(p => p.slice(0, -1));
    }
  }

  function startEdit(t: Task) {
    setEditing(t.id);
    setForm({
      title: t.title, description: t.description,
      primary_role_id: t.primary_role_id, goal_id: t.goal_id ?? '',
      task_type: t.task_type, impact: t.impact, effort: t.effort,
      estimated_minutes: t.estimated_minutes != null ? String(t.estimated_minutes) : '',
      scheduled_date: t.scheduled_date ?? '',
      soft_deadline: t.soft_deadline ?? '',
      deadline: t.deadline ?? '',
      context_tags: '',
    });
    setSelectedTags(t.context_tags ?? []);
    setShowForm(true);
  }

  function cancelEdit() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSelectedTags([]);
    setTagInput('');
    setShowForm(false);
  }

  async function save() {
    setSaving(true);
    try {
      const estMins = form.estimated_minutes ? parseInt(form.estimated_minutes) : null;
      const payload: Record<string, unknown> = {
        title: form.title,
        description: form.description,
        primary_role_id: form.primary_role_id,
        goal_id: form.goal_id || null,
        task_type: form.task_type,
        impact: form.impact,
        effort: form.effort,
        estimated_minutes: estMins,
        context_tags: selectedTags,
        deadline: form.deadline || null,
        soft_deadline: form.soft_deadline || null,
        scheduled_date: form.scheduled_date || null,
      };
      if (editing) {
        if (!form.deadline) payload['clear_deadline'] = true;
        if (!form.soft_deadline) payload['clear_soft_deadline'] = true;
        if (!form.scheduled_date) payload['clear_scheduled_date'] = true;
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
      todo: 'bg-blue-100 text-blue-700',
      done: 'bg-green-100 text-green-700',
      archived: 'bg-gray-100 text-gray-500',
    };
    return `text-xs px-2 py-0.5 rounded-full font-medium capitalize ${map[status] ?? 'bg-gray-100 text-gray-600'}`;
  }

  function impactLabel(n: number) {
    return ['','Very Low','Low','Medium','High','Very High'][n] ?? n;
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
          ['status', [{ v: 'todo', l: 'Todo' }, { v: 'done', l: 'Done' }], 'Any status'],
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
            {/* Title */}
            <input className="col-span-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="Title *" value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            {/* Description */}
            <textarea className="col-span-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              rows={2} placeholder="Description (optional)" value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            {/* Role */}
            <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.primary_role_id}
              onChange={e => setForm(p => ({ ...p, primary_role_id: e.target.value }))}>
              <option value="">Role…</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            {/* Goal */}
            <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.goal_id}
              onChange={e => setForm(p => ({ ...p, goal_id: e.target.value }))}>
              <option value="">Goal (optional)</option>
              {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
            {/* Task type */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Type</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={form.task_type}
                onChange={e => setForm(p => ({ ...p, task_type: e.target.value as TaskType }))}>
                {TASK_TYPES.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
            {/* Impact */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Impact</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={form.impact}
                onChange={e => setForm(p => ({ ...p, impact: Number(e.target.value) }))}>
                {IMPACT_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
            {/* Effort */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Effort</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={form.effort}
                onChange={e => setForm(p => ({ ...p, effort: Number(e.target.value) }))}>
                {EFFORT_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
            {/* Estimated minutes */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Est. minutes</label>
              <input type="number" min={1}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="e.g. 30" value={form.estimated_minutes}
                onChange={e => setForm(p => ({ ...p, estimated_minutes: e.target.value }))} />
            </div>
            {/* Scheduled date */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Scheduled date</label>
              <input type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={form.scheduled_date}
                onChange={e => setForm(p => ({ ...p, scheduled_date: e.target.value }))} />
            </div>
            {/* Soft deadline */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Soft deadline</label>
              <input type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={form.soft_deadline}
                onChange={e => setForm(p => ({ ...p, soft_deadline: e.target.value }))} />
            </div>
            {/* Hard deadline */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Hard deadline</label>
              <input type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={form.deadline}
                onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} />
            </div>
            {/* Context tags with autocomplete */}
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Context tags</label>
              <div className="flex flex-wrap gap-1.5 border border-gray-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-400 bg-white min-h-[38px]">
                {selectedTags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                    #{tag}
                    <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-500">×</button>
                  </span>
                ))}
                <div className="relative flex-1 min-w-[120px]">
                  <input ref={tagRef}
                    className="w-full text-sm outline-none bg-transparent"
                    placeholder={selectedTags.length ? '' : 'Add tags…'}
                    value={tagInput}
                    onChange={e => handleTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                  />
                  {tagSugs.length > 0 && (
                    <div className="absolute top-full left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[160px] mt-1">
                      {tagSugs.map(s => (
                        <button key={s} type="button"
                          className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700"
                          onMouseDown={e => { e.preventDefault(); addTag(s); }}>
                          #{s}
                        </button>
                      ))}
                      {!allTags.includes(tagInput.trim()) && tagInput.trim() && (
                        <button type="button"
                          className="w-full text-left px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50"
                          onMouseDown={e => { e.preventDefault(); addTag(tagInput.trim()); }}>
                          + Create "{tagInput.trim()}"
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
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
                  disabled={t.status === 'done'}
                  className="mt-1 w-5 h-5 rounded-full border-2 border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 transition-colors disabled:opacity-30 shrink-0"
                  title="Mark complete" />
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-gray-900 ${t.status === 'done' ? 'line-through text-gray-400' : ''}`}>
                    {t.title}
                  </p>
                  {t.description && (
                    <p className="text-sm text-gray-500 mt-0.5 truncate">{t.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className={statusBadge(t.status)}>{t.status}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                      {t.task_type === 'daily' ? '🔁 Daily' : '✅ One-time'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">
                      ⚡ {impactLabel(t.impact)}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                      🛠 effort {t.effort}
                    </span>
                    {t.estimated_minutes && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-50 text-slate-600">
                        ⏱ {t.estimated_minutes}min
                      </span>
                    )}
                    {t.scheduled_date && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">
                        📅 {t.scheduled_date.slice(0,10)}
                      </span>
                    )}
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
