import { useEffect, useState, useCallback } from "react";
import { useApi } from "../lib/useApi";
import Spinner from "../components/Spinner";
import type { RoleBalanceScore, ScoredTask } from "../types";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

// ── Helpers ───────────────────────────────────────────────────────────────────

function balanceColor(score: number) {
  if (score >= 0.75) return "bg-emerald-100 text-emerald-800";
  if (score >= 0.4) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-700";
}

function balanceBar(pct: number, color: string) {
  const bar = Math.min(100, Math.max(0, pct));
  const bg =
    pct >= 75 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-400" : "bg-red-500";
  return (
    <div
      className={`w-full rounded-full h-2 bg-gray-200 ${color}`}
      title={`${bar.toFixed(0)}%`}
    >
      <div
        className={`h-2 rounded-full ${bg} transition-all`}
        style={{ width: `${bar}%` }}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const api = useApi();
  const [balance, setBalance] = useState<RoleBalanceScore[]>([]);
  const [tasks, setTasks] = useState<ScoredTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [balRes, taskRes] = await Promise.all([
        api.get<{ data: RoleBalanceScore[] }>("/roles/balance"),
        api.get<{ data: ScoredTask[] }>("/tasks/ranked?limit=5"),
      ]);
      setBalance(balRes.data.data ?? []);
      setTasks(taskRes.data.data ?? []);
    } catch {
      setError("Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  // Recharts radar data — one entry per role
  const radarData = balance.map((r) => ({
    role: r.role_name.length > 10 ? r.role_name.slice(0, 10) + "…" : r.role_name,
    value: Math.round(r.display_pct),
    fullMark: 100,
  }));

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">📊 Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Life balance overview + top priorities
        </p>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : (
        <>
          {/* ── Life Balance Section ──────────────────────────────────── */}
          <section>
            <h2 className="text-base font-semibold text-gray-700 mb-3">
              ⚖️ Life Balance Score
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Rolling 14-day window · sorted by most neglected first
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Radar chart */}
              {radarData.length >= 3 ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">
                    Radar view
                  </p>
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis
                        dataKey="role"
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                      />
                      <Radar
                        name="Balance %"
                        dataKey="value"
                        stroke="#6366f1"
                        fill="#6366f1"
                        fillOpacity={0.25}
                      />
                      <Tooltip
                        formatter={(v: number) => [`${v}%`, "Balance"]}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center justify-center text-sm text-gray-400">
                  Radar requires ≥3 roles
                </div>
              )}

              {/* Bar list */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
                <p className="text-xs font-medium text-gray-500 mb-2">
                  Per-role breakdown
                </p>
                {balance.length === 0 ? (
                  <p className="text-sm text-gray-400">No roles yet.</p>
                ) : (
                  balance.map((r) => (
                    <div key={r.role_id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full inline-block"
                            style={{ backgroundColor: r.role_color || "#6366f1" }}
                          />
                          {r.role_name}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${balanceColor(r.balance_score)}`}
                        >
                          {r.display_pct.toFixed(0)}%
                        </span>
                      </div>
                      {balanceBar(r.display_pct, "")}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {r.actual.toFixed(1)} / {r.expected.toFixed(1)} pts
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* ── Top 5 Priorities ─────────────────────────────────────── */}
          <section>
            <h2 className="text-base font-semibold text-gray-700 mb-3">
              🎯 Top 5 Priorities Now
            </h2>
            {tasks.length === 0 ? (
              <p className="text-sm text-gray-400">No tasks to show.</p>
            ) : (
              <ol className="space-y-2">
                {tasks.map(({ task, score, explanations }, i) => (
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
                      {/* Explanation chips */}
                      {(explanations ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {explanations.map((ex, j) => (
                            <span
                              key={j}
                              className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100"
                            >
                              {ex}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="mt-0.5 text-xs font-semibold text-gray-500 shrink-0">
                      {score.toFixed(1)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  );
}
