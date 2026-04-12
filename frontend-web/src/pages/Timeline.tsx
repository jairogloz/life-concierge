import { useEffect, useState, useCallback } from 'react';
import { useApi } from '../lib/useApi';
import Spinner from '../components/Spinner';
import type { TimelineEvent, TimelineEventType } from '../types';

// ── Event config ──────────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<TimelineEventType, { icon: string; label: string; color: string }> = {
  task_completed:    { icon: '✅', label: 'Task completed',    color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  expense_logged:    { icon: '💰', label: 'Expense logged',    color: 'bg-blue-50 text-blue-700 border-blue-200'     },
  wishlist_evaluated:{ icon: '🛒', label: 'Wishlist evaluated',color: 'bg-purple-50 text-purple-700 border-purple-200' },
  role_updated:      { icon: '🎭', label: 'Role updated',      color: 'bg-gray-50 text-gray-700 border-gray-200'      },
  goal_updated:      { icon: '🏆', label: 'Goal updated',      color: 'bg-amber-50 text-amber-700 border-amber-200'   },
};

const DOMAIN_COLOR: Record<string, string> = {
  tasks:    'bg-emerald-100 text-emerald-700',
  finance:  'bg-blue-100 text-blue-700',
  wishlist: 'bg-purple-100 text-purple-700',
  roles:    'bg-gray-100 text-gray-700',
  goals:    'bg-amber-100 text-amber-700',
};

function fmt(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function payloadSummary(event: TimelineEvent): string | null {
  const p = event.payload as Record<string, unknown>;
  if (!p || Object.keys(p).length === 0) return null;
  const parts: string[] = [];
  if (typeof p.title === 'string')   parts.push(p.title);
  if (typeof p.amount === 'number')  parts.push(`$${p.amount}`);
  if (typeof p.verdict === 'string') parts.push(`verdict: ${p.verdict}`);
  return parts.length ? parts.join(' · ') : null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Timeline() {
  const api = useApi();
  const [events, setEvents]   = useState<TimelineEvent[]>([]);
  const [total, setTotal]     = useState(0);
  const [offset, setOffset]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const limit = 20;

  const load = useCallback(async (off: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: TimelineEvent[]; total: number }>(
        `/timeline?limit=${limit}&offset=${off}`
      );
      setEvents(off === 0 ? (res.data.data ?? []) : prev => [...prev, ...(res.data.data ?? [])]);
      setTotal(res.data.total ?? 0);
      setOffset(off);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Failed to load timeline.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(0); }, [load]);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Timeline</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your life activity log — {total} event{total !== 1 ? 's' : ''} recorded</p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {loading && offset === 0 ? <Spinner /> : events.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-medium">No events yet.</p>
          <p className="text-sm mt-1">Events appear here automatically as you use the app.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />

          <ol className="space-y-4">
            {events.map(event => {
              const cfg = EVENT_CONFIG[event.event_type] ?? { icon: '📌', label: event.event_type, color: 'bg-gray-50 text-gray-700 border-gray-200' };
              const domainPill = DOMAIN_COLOR[event.domain] ?? 'bg-gray-100 text-gray-700';
              const summary = payloadSummary(event);
              return (
                <li key={event.id} className="flex gap-4 items-start">
                  {/* Icon dot */}
                  <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-lg border ${cfg.color} shrink-0`}>
                    {cfg.icon}
                  </div>
                  {/* Card */}
                  <div className="flex-1 bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 text-sm">{cfg.label}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${domainPill}`}>
                          {event.domain}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">{fmt(event.occurred_at)}</span>
                    </div>
                    {summary && (
                      <p className="text-sm text-gray-500 mt-1">{summary}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {offset + limit < total && (
            <button
              onClick={() => load(offset + limit)}
              disabled={loading}
              className="mt-6 w-full py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              {loading ? 'Loading…' : `Load more (${total - offset - limit} remaining)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
