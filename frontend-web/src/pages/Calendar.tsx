import { useCallback, useEffect, useMemo, useState } from "react";
import { useApi } from "../lib/useApi";
import type { Role, Task } from "../types";

type ViewMode = "month" | "week" | "day";

type RoleWithColor = Role & { color?: string };

function ymd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function monthGridStart(date: Date): Date {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  return startOfWeek(first);
}

function monthGridEnd(date: Date): Date {
  const first = monthGridStart(date);
  return addDays(first, 41);
}

function dueLabel(task: Task): { label: string; className: string } | null {
  if (task.deadline) {
    return { label: "hard deadline", className: "bg-red-50 text-red-700 border border-red-200" };
  }
  if (task.soft_deadline) {
    return { label: "soft deadline", className: "bg-amber-50 text-amber-700 border border-amber-200" };
  }
  return null;
}

function TaskCard({
  task,
  onDragStart,
}: {
  task: Task;
  onDragStart?: (taskId: string) => void;
}) {
  const due = dueLabel(task);

  return (
    <div
      className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs shadow-sm"
      draggable={Boolean(onDragStart)}
      onDragStart={() => onDragStart?.(task.id)}
    >
      <p className="font-medium text-gray-900 truncate">{task.title}</p>
      <div className="flex items-center gap-1 mt-1">
        {task.task_type === "daily" ? (
          <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            daily
          </span>
        ) : (
          <span className="px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            one-time
          </span>
        )}
        {due && <span className={`px-1.5 py-0.5 rounded-full ${due.className}`}>{due.label}</span>}
      </div>
    </div>
  );
}

export default function Calendar() {
  const api = useApi();

  const [view, setView] = useState<ViewMode>("month");
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [roles, setRoles] = useState<Record<string, RoleWithColor>>({});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [unscheduled, setUnscheduled] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [draggingTaskID, setDraggingTaskID] = useState<string | null>(null);

  const range = useMemo(() => {
    const day = new Date(anchor);
    day.setHours(0, 0, 0, 0);

    if (view === "day") {
      return { from: ymd(day), to: ymd(day) };
    }
    if (view === "week") {
      const weekStart = startOfWeek(day);
      const weekEnd = addDays(weekStart, 6);
      return { from: ymd(weekStart), to: ymd(weekEnd) };
    }

    const from = monthGridStart(day);
    const to = monthGridEnd(day);
    return { from: ymd(from), to: ymd(to) };
  }, [anchor, view]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, scheduledRes, allTodoRes] = await Promise.all([
        api.get<{ data: RoleWithColor[] }>("/roles"),
        api.get<{ data: Task[] }>(
          `/tasks?status=todo&scheduled_from=${range.from}&scheduled_to=${range.to}`,
        ),
        api.get<{ data: Task[] }>("/tasks?status=todo"),
      ]);

      const roleMap: Record<string, RoleWithColor> = {};
      for (const role of rolesRes.data.data ?? []) {
        roleMap[role.id] = role;
      }
      setRoles(roleMap);

      const scheduledTasks = scheduledRes.data.data ?? [];
      setTasks(scheduledTasks);

      const allTodo = allTodoRes.data.data ?? [];
      setUnscheduled(allTodo.filter((task) => !task.scheduled_date));
    } finally {
      setLoading(false);
    }
  }, [api, range.from, range.to]);

  useEffect(() => {
    load();
  }, [load]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      const parsed = parseDate(task.scheduled_date);
      if (!parsed) continue;
      const key = ymd(parsed);
      const bucket = map.get(key) ?? [];
      bucket.push(task);
      map.set(key, bucket);
    }
    return map;
  }, [tasks]);

  const dayTasks = useMemo(() => {
    if (!selectedDay) return [] as Task[];
    return tasksByDate.get(selectedDay) ?? [];
  }, [selectedDay, tasksByDate]);

  async function reschedule(taskID: string, targetDay: string) {
    const dateISO = `${targetDay}T00:00:00.000Z`;
    await api.put(`/tasks/${taskID}`, { scheduled_date: dateISO });
    await load();
  }

  function prev() {
    const next = new Date(anchor);
    if (view === "day") next.setDate(next.getDate() - 1);
    if (view === "week") next.setDate(next.getDate() - 7);
    if (view === "month") next.setMonth(next.getMonth() - 1);
    setAnchor(next);
  }

  function next() {
    const upcoming = new Date(anchor);
    if (view === "day") upcoming.setDate(upcoming.getDate() + 1);
    if (view === "week") upcoming.setDate(upcoming.getDate() + 7);
    if (view === "month") upcoming.setMonth(upcoming.getMonth() + 1);
    setAnchor(upcoming);
  }

  const monthDays = useMemo(() => {
    const first = monthGridStart(anchor);
    return Array.from({ length: 42 }, (_, i) => addDays(first, i));
  }, [anchor]);

  const weekDays = useMemo(() => {
    const first = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(first, i));
  }, [anchor]);

  const selectedYmd = ymd(anchor);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-sm text-gray-500 mt-0.5">Month / Week / Day planning and scheduling</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prev} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">←</button>
          <button onClick={() => setAnchor(new Date())} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">Today</button>
          <button onClick={next} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">→</button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {(["month", "week", "day"] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setView(mode)}
            className={`px-3 py-1.5 rounded-full text-sm border ${
              view === mode
                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                : "bg-gray-50 text-gray-600 border-gray-200"
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400">Loading calendar…</div>
      ) : (
        <>
          {view === "month" && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="grid grid-cols-7 text-xs text-gray-500 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
                  <div key={label} className="px-2 py-1 font-semibold">{label}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {monthDays.map((day) => {
                  const key = ymd(day);
                  const items = tasksByDate.get(key) ?? [];
                  const isCurrentMonth = day.getMonth() === anchor.getMonth();
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedDay(key)}
                      className={`min-h-20 rounded-lg border px-2 py-1 text-left ${
                        isCurrentMonth
                          ? "border-gray-200 bg-white"
                          : "border-gray-100 bg-gray-50"
                      }`}
                    >
                      <p className={`text-xs ${isCurrentMonth ? "text-gray-700" : "text-gray-400"}`}>
                        {day.getDate()}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {items.slice(0, 5).map((task) => (
                          <span
                            key={task.id}
                            className="w-2 h-2 rounded-full"
                            style={{
                              backgroundColor:
                                roles[task.primary_role_id]?.color || "#6366f1",
                            }}
                            title={task.title}
                          />
                        ))}
                        {items.length > 5 && (
                          <span className="text-[10px] text-gray-400">+{items.length - 5}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {view === "week" && (
            <div className="grid grid-cols-8 gap-3">
              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <p className="text-xs font-semibold text-gray-500 mb-2">Unscheduled</p>
                <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                  {unscheduled.map((task) => (
                    <TaskCard key={task.id} task={task} onDragStart={setDraggingTaskID} />
                  ))}
                  {unscheduled.length === 0 && (
                    <p className="text-xs text-gray-400">No unscheduled backlog.</p>
                  )}
                </div>
              </div>

              {weekDays.map((day) => {
                const key = ymd(day);
                const items = tasksByDate.get(key) ?? [];
                return (
                  <div
                    key={key}
                    className="rounded-xl border border-gray-200 bg-white p-3"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={async () => {
                      if (!draggingTaskID) return;
                      await reschedule(draggingTaskID, key);
                      setDraggingTaskID(null);
                    }}
                  >
                    <p className="text-xs font-semibold text-gray-500 mb-2">
                      {day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                    <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                      {items.map((task) => (
                        <TaskCard key={task.id} task={task} onDragStart={setDraggingTaskID} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {view === "day" && (
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  {new Date(anchor).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <div className="space-y-2">
                  {(tasksByDate.get(selectedYmd) ?? []).map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                  {(tasksByDate.get(selectedYmd) ?? []).length === 0 && (
                    <p className="text-sm text-gray-400">No tasks scheduled for this day.</p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-semibold text-gray-500 mb-2">Unscheduled backlog</p>
                <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                  {unscheduled.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                  {unscheduled.length === 0 && (
                    <p className="text-xs text-gray-400">No unscheduled tasks.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {selectedDay && (
        <div className="fixed inset-0 z-30 bg-black/20 flex justify-end" onClick={() => setSelectedDay(null)}>
          <div
            className="w-full max-w-md h-full bg-white border-l border-gray-200 p-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-gray-900">{selectedDay}</p>
              <button
                className="text-sm text-gray-500 hover:text-gray-700"
                onClick={() => setSelectedDay(null)}
              >
                Close
              </button>
            </div>
            <div className="space-y-2">
              {dayTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
              {dayTasks.length === 0 && (
                <p className="text-sm text-gray-400">No tasks on this day.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
