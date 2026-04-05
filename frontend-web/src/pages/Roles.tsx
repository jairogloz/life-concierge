import { useEffect, useState, useCallback } from 'react';
import { useApi } from '../lib/useApi';
import Spinner from '../components/Spinner';
import type { Role } from '../types';

const EMPTY: Partial<Role> = { name: '', description: '', weight: 5 };

export default function Roles() {
  const api = useApi();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<Role>>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Role[] }>('/roles');
      setRoles(res.data.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  function startEdit(role: Role) {
    setEditing(role.id);
    setForm({ name: role.name, description: role.description, weight: role.weight });
  }

  function cancelEdit() {
    setEditing(null);
    setForm(EMPTY);
  }

  async function save() {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/roles/${editing}`, form);
      } else {
        await api.post('/roles', form);
      }
      cancelEdit();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this role?')) return;
    await api.delete(`/roles/${id}`);
    await load();
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Roles</h1>

      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          {editing ? 'Edit Role' : 'New Role'}
        </h2>
        <div className="space-y-3">
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Name"
            value={form.name ?? ''}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          />
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Description (optional)"
            value={form.description ?? ''}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          />
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Weight: <strong>{form.weight}</strong>
            </label>
            <input
              type="range" min={1} max={10} step={0.5}
              className="w-full accent-indigo-600"
              value={form.weight ?? 5}
              onChange={e => setForm(p => ({ ...p, weight: parseFloat(e.target.value) }))}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={save}
            disabled={saving || !form.name}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
          </button>
          {editing && (
            <button onClick={cancelEdit}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {loading ? <Spinner /> : (
        <ul className="space-y-3">
          {roles.map(role => (
            <li key={role.id}
              className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{role.name}</p>
                {role.description && (
                  <p className="text-sm text-gray-500 truncate">{role.description}</p>
                )}
                <div className="mt-1 w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${(role.weight / 10) * 100}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-0.5">weight {role.weight}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => startEdit(role)}
                  className="text-xs px-2 py-1 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
                  Edit
                </button>
                <button onClick={() => remove(role.id)}
                  className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors">
                  Delete
                </button>
              </div>
            </li>
          ))}
          {roles.length === 0 && (
            <p className="text-center text-gray-400 py-12">No roles yet — create one above.</p>
          )}
        </ul>
      )}
    </div>
  );
}
