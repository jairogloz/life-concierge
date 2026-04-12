import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApi } from "../lib/useApi";
import Spinner from "../components/Spinner";
import type { ScoredTask, DailyBrief, Role } from "../types";

// ── DailyBriefCard ─────────────────────────────────────────────────────────

function DailyBriefCard() {
  const api = useApi();
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("today_brief_collapsed") === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("today_brief_collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  async function fetchBrief() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get<DailyBrief>("/ai/daily-brief");
      setBrief(res.data);
    } catch (e: any) {
      setError(
        e?.response?.data?.error?.message ?? "Failed to generate brief.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!brief && collapsed) {
    return (
      <div className="mb-6 p-4 rounded-xl border border-indigo-200 bg-indigo-50">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-indigo-900">🤖 Daily Strategy Brief</p>
          <button
            onClick={() => setCollapsed(false)}
            className="text-xs text-indigo-500 hover:text-indigo-700"
          >
            Expand
          </button>
        </div>
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="mb-6 p-4 rounded-xl border border-indigo-200 bg-indigo-50">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-indigo-900">
              🤖 Daily Strategy Brief
            </p>
            <p className="text-sm text-indigo-600 mt-0.5">
              Get AI-powered priorities for today
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCollapsed(true)}
              className="text-xs text-indigo-500 hover:text-indigo-700"
            >
              Collapse
            </button>
            <button
              onClick={fetchBrief}
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40"
            >
              {loading ? "Generating…" : "Generate"}
            </button>
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-indigo-900">🤖 Daily Strategy Brief</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="text-xs text-indigo-500 hover:text-indigo-700"
          >
            {collapsed ? "Expand" : "Collapse"}
          </button>
          <button
            onClick={fetchBrief}
            disabled={loading}
            className="text-xs text-indigo-500 hover:text-indigo-700 disabled:opacity-40"
          >
            {loading ? "Refreshing…" : "↻ Refresh"}
          </button>
        </div>
      </div>
      {collapsed ? null : (
        <>
      {/* Top actions */}
      <ol className="space-y-1.5">
        {brief.top_actions.map((a) => (
          <li key={a.priority} className="flex items-start gap-2 text-sm">
            <span className="font-bold text-indigo-600 shrink-0">
              {a.priority}.
            </span>
            <span className="text-gray-800">{a.description}</span>
            <span className="ml-auto shrink-0 text-xs px-2 py-0.5 rounded-full bg-white text-indigo-600 border border-indigo-200">
              {a.domain}
            </span>
          </li>
        ))}
      </ol>
      {/* Alerts */}
      <div className="grid grid-cols-2 gap-2">
        {brief.finance_alert && (
          <div className="rounded-lg bg-white border border-blue-200 p-2">
            <p className="text-xs font-semibold text-blue-700">💰 Finance</p>
            <p className="text-xs text-gray-600 mt-0.5">
              {brief.finance_alert}
            </p>
          </div>
        )}
        {brief.health_nudge && (
          <div className="rounded-lg bg-white border border-emerald-200 p-2">
            <p className="text-xs font-semibold text-emerald-700">
              🌿 Wellbeing
            </p>
            <p className="text-xs text-gray-600 mt-0.5">{brief.health_nudge}</p>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}

export default function Today() {
  const api = useApi();
  const [searchParams, setSearchParams] = useSearchParams();
  const [ranked, setRanked] = useState<ScoredTask[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);

  const [filterMode, setFilterMode] = useState<"all" | "role" | "tag">(
    (searchParams.get("mode") as "all" | "role" | "tag") || "all",
  );
  const [selectedRoleId, setSelectedRoleId] = useState(searchParams.get("role") || "");
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    const value = searchParams.get("tags") || "";
    return value ? value.split(",").filter(Boolean) : [];
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rankedRes, rolesRes, tagsRes] = await Promise.all([
        api.get<{ data: ScoredTask[] }>("/tasks/ranked?limit=50"),
        api.get<{ data: Role[] }>("/roles"),
        api.get<{ data: string[] }>("/tasks/tags"),
      ]);
      setRanked(rankedRes.data.data ?? []);
      setRoles(rolesRes.data.data ?? []);
      setTags(tagsRes.data.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const next = new URLSearchParams();
    next.set("mode", filterMode);
    if (selectedRoleId) next.set("role", selectedRoleId);
    if (selectedTags.length) next.set("tags", selectedTags.join(","));
    setSearchParams(next, { replace: true });
  }, [filterMode, selectedRoleId, selectedTags, setSearchParams]);

  async function complete(taskId: string) {
    setCompleting(taskId);
    try {
      await api.patch(`/tasks/${taskId}/complete`);
      setRanked((prev) => prev.filter((s) => s.task.id !== taskId));
    } finally {
      setCompleting(null);
    }
  }

  function scoreColor(score: number) {
    if (score >= 70) return "bg-red-100 text-red-700";
    if (score >= 40) return "bg-orange-100 text-orange-700";
    return "bg-green-100 text-green-700";
  }

  function ymd(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function taskScheduledYMD(value: string | null): string | null {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return ymd(parsed);
  }

  function isDailyDoneToday(task: ScoredTask["task"]): boolean {
    if (task.task_type !== "daily") return false;
    const today = ymd(new Date());
    return (task.completion_log ?? []).some((entry) => entry.date === today && entry.done);
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag],
    );
  }

  const filteredRanked = useMemo(() => {
    return ranked.filter(({ task }) => {
      if (filterMode === "role" && selectedRoleId) {
        return task.primary_role_id === selectedRoleId;
      }
      if (filterMode === "tag" && selectedTags.length > 0) {
        const taskTags = task.context_tags ?? [];
        return selectedTags.some((tag) => taskTags.includes(tag));
      }
      return true;
    });
  }, [ranked, filterMode, selectedRoleId, selectedTags]);

  const [scheduledToday, backlog] = useMemo(() => {
    const today = ymd(new Date());
    const scheduled: ScoredTask[] = [];
    const unscheduled: ScoredTask[] = [];
    for (const row of filteredRanked) {
      if (taskScheduledYMD(row.task.scheduled_date) === today) {
        scheduled.push(row);
      } else {
        unscheduled.push(row);
      }
    }
    return [scheduled, unscheduled];
  }, [filteredRanked]);

  function renderTaskList(items: ScoredTask[]) {
    return (
      <ol className="space-y-3">
        {items.map(({ task, score, explanations }, i) => (
          <li
            key={task.id}
            className="flex items-start gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm"
          >
            <span className="mt-0.5 text-sm font-bold text-gray-400 w-5 shrink-0">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">
                {task.title}
              </p>
              {task.description && (
                <p className="text-sm text-gray-500 truncate mt-0.5">
                  {task.description}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${scoreColor(score)}`}
                >
                  score {score.toFixed(1)}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                  {task.task_type === "daily" ? "🔁 daily" : "✅ one-time"}
                </span>
                {task.task_type === "daily" && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      isDailyDoneToday(task)
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-gray-50 text-gray-500 border-gray-200"
                    }`}
                  >
                    {isDailyDoneToday(task) ? "● done today" : "○ not done today"}
                  </span>
                )}
                {task.deadline && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                    due {new Date(task.deadline).toLocaleDateString()}
                  </span>
                )}
                {(task.context_tags ?? []).map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600"
                  >
                    #{tag}
                  </span>
                ))}
                {(explanations ?? []).map((ex, j) => (
                  <span
                    key={j}
                    className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-500 border border-indigo-100"
                    title="Score factor"
                  >
                    {ex}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => complete(task.id)}
              disabled={completing === task.id}
              className="mt-0.5 shrink-0 w-6 h-6 rounded-full border-2 border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 transition-colors disabled:opacity-40 flex items-center justify-center"
              title="Mark complete"
            >
              {completing === task.id && (
                <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              )}
            </button>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Today</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Your highest-priority tasks right now
          </p>
        </div>
        <Link
          to="/inbox"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          ✨ Quick Capture
        </Link>
      </div>

      <DailyBriefCard />

      <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Task filters</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterMode("all")}
            className={`text-xs px-3 py-1.5 rounded-full border ${
              filterMode === "all"
                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                : "bg-gray-50 text-gray-600 border-gray-200"
            }`}
          >
            All tasks
          </button>
          <button
            onClick={() => setFilterMode("role")}
            className={`text-xs px-3 py-1.5 rounded-full border ${
              filterMode === "role"
                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                : "bg-gray-50 text-gray-600 border-gray-200"
            }`}
          >
            Per role
          </button>
          <button
            onClick={() => setFilterMode("tag")}
            className={`text-xs px-3 py-1.5 rounded-full border ${
              filterMode === "tag"
                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                : "bg-gray-50 text-gray-600 border-gray-200"
            }`}
          >
            Per tag
          </button>
        </div>

        {filterMode === "role" && (
          <select
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">All roles</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        )}

        {filterMode === "tag" && (
          <div className="flex flex-wrap gap-1.5">
            {tags.length === 0 ? (
              <p className="text-xs text-gray-400">No tags yet.</p>
            ) : (
              tags.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`text-xs px-2 py-1 rounded-full border ${
                      active
                        ? "bg-purple-50 text-purple-700 border-purple-200"
                        : "bg-gray-50 text-gray-600 border-gray-200"
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {loading ? (
        <Spinner />
      ) : filteredRanked.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">🎉</p>
          <p className="font-medium">No tasks match this filter.</p>
          <p className="text-sm mt-1">
            Add tasks or use Quick Capture to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">
              Scheduled for today ({scheduledToday.length})
            </h2>
            {scheduledToday.length === 0 ? (
              <p className="text-sm text-gray-400">No tasks scheduled for today.</p>
            ) : (
              renderTaskList(scheduledToday)
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">
              Anytime / backlog ({backlog.length})
            </h2>
            {backlog.length === 0 ? (
              <p className="text-sm text-gray-400">No backlog tasks for this filter.</p>
            ) : (
              renderTaskList(backlog)
            )}
          </section>
        </div>
      )}
    </div>
  );
}
