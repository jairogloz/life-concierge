import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApi } from "../lib/useApi";
import Spinner from "../components/Spinner";
import type {
  Goal,
  Role,
  Task,
  Week,
  WeekAllocation,
  WeekBalanceSnapshot,
  WeekReviewAction,
} from "../types";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const DAYS = [
  { index: 7, label: "Sun" },
  { index: 1, label: "Mon" },
  { index: 2, label: "Tue" },
  { index: 3, label: "Wed" },
  { index: 4, label: "Thu" },
  { index: 5, label: "Fri" },
  { index: 6, label: "Sat" },
];

const START_HOUR = 6;
const END_HOUR = 21;
const WEEK_PRIORITY_TAG = "week_priority";
const SLOT_ROW_HEIGHT_PX = 22;

function fmtTime(minuteOfDay?: number | null) {
  if (minuteOfDay == null) return "";
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function toDateInput(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function parseDateOnly(value: string) {
  const raw = value.slice(0, 10);
  const [year, month, day] = raw.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function weekLabel(week: Week) {
  return `${week.starts_on.slice(0, 10)} → ${week.ends_on.slice(0, 10)} (${week.status})`;
}

function mergeRadarData(
  current: WeekBalanceSnapshot["current"],
  target: WeekBalanceSnapshot["target"],
) {
  const byRole = new Map<
    string,
    { role: string; current: number; target: number }
  >();
  current.forEach((point) => {
    byRole.set(point.role_id, {
      role:
        point.role_name.length > 10
          ? `${point.role_name.slice(0, 10)}…`
          : point.role_name,
      current: point.value,
      target: 0,
    });
  });
  target.forEach((point) => {
    const existing = byRole.get(point.role_id);
    if (existing) {
      existing.target = point.value;
      return;
    }
    byRole.set(point.role_id, {
      role:
        point.role_name.length > 10
          ? `${point.role_name.slice(0, 10)}…`
          : point.role_name,
      current: 0,
      target: point.value,
    });
  });
  return Array.from(byRole.values());
}

export default function WeeklyPlanner() {
  const api = useApi();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [weeks, setWeeks] = useState<Week[]>([]);
  const [activeWeek, setActiveWeek] = useState<Week | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [backlog, setBacklog] = useState<Task[]>([]);
  const [allocations, setAllocations] = useState<WeekAllocation[]>([]);
  const [balance, setBalance] = useState<WeekBalanceSnapshot>({
    current: [],
    target: [],
  });

  const [priorityInput, setPriorityInput] = useState("");
  const [priorityRoleID, setPriorityRoleID] = useState("");
  const [backlogRoleFilter, setBacklogRoleFilter] = useState("");
  const [importantOnly, setImportantOnly] = useState(false);
  const [reviewSelected, setReviewSelected] = useState<Record<string, boolean>>(
    {},
  );
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  const [selectedTaskID, setSelectedTaskID] = useState("");
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    primary_role_id: "",
    goal_id: "",
    impact: 3,
    effort: 3,
    estimated_minutes: "",
    scheduled_date: "",
    soft_deadline: "",
    deadline: "",
  });
  const [taskSaving, setTaskSaving] = useState(false);
  const [now, setNow] = useState(new Date());

  const selectedWeekId = searchParams.get("week") || "";

  const currentWeek = useMemo(() => {
    if (!weeks.length) return activeWeek;
    if (selectedWeekId) {
      return weeks.find((week) => week.id === selectedWeekId) || activeWeek;
    }
    return activeWeek;
  }, [weeks, activeWeek, selectedWeekId]);

  const groupedGoals = useMemo(() => {
    const map = new Map<string, Goal[]>();
    goals.forEach((goal) => {
      const list = map.get(goal.role_id) ?? [];
      list.push(goal);
      map.set(goal.role_id, list);
    });
    return map;
  }, [goals]);

  const roleMap = useMemo(() => {
    const map = new Map<string, Role>();
    roles.forEach((role) => map.set(role.id, role));
    return map;
  }, [roles]);

  const goalMap = useMemo(() => {
    const map = new Map<string, Goal>();
    goals.forEach((goal) => map.set(goal.id, goal));
    return map;
  }, [goals]);

  const visibleBacklog = useMemo(() => {
    return backlog.filter((task) => {
      if ((task.context_tags ?? []).includes(WEEK_PRIORITY_TAG)) return false;
      if (backlogRoleFilter && task.primary_role_id !== backlogRoleFilter)
        return false;
      if (importantOnly && task.impact < 4) return false;
      if (task.status === "done" || task.status === "archived") return false;
      return true;
    });
  }, [backlog, backlogRoleFilter, importantOnly]);

  const weekPriorityTasks = useMemo(() => {
    return backlog.filter((task) => {
      if (!(task.context_tags ?? []).includes(WEEK_PRIORITY_TAG)) return false;
      return task.status !== "done" && task.status !== "archived";
    });
  }, [backlog]);

  const allocationByTaskID = useMemo(() => {
    const map = new Map<string, WeekAllocation>();
    allocations.forEach((item) => map.set(item.task_id, item));
    return map;
  }, [allocations]);

  const dailyByDay = useMemo(() => {
    const map = new Map<number, WeekAllocation[]>();
    DAYS.forEach((day) => map.set(day.index, []));
    allocations.forEach((item) => {
      if (item.lane !== "daily_priority") return;
      const list = map.get(item.day_of_week) ?? [];
      list.push(item);
      map.set(item.day_of_week, list);
    });
    return map;
  }, [allocations]);

  const slotByDay = useMemo(() => {
    const map = new Map<string, WeekAllocation[]>();
    allocations.forEach((item) => {
      if (item.lane !== "timeslot" || item.slot_minute_of_day == null) return;
      const key = `${item.day_of_week}-${item.slot_minute_of_day}`;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    });
    return map;
  }, [allocations]);

  const quarterSlots = useMemo(() => {
    const slots: number[] = [];
    for (
      let minute = START_HOUR * 60;
      minute <= END_HOUR * 60 + 45;
      minute += 15
    ) {
      slots.push(minute);
    }
    return slots;
  }, []);

  const allocationsByDay = useMemo(() => {
    const map = new Map<number, WeekAllocation[]>();
    DAYS.forEach((day) => map.set(day.index, []));
    allocations.forEach((allocation) => {
      const list = map.get(allocation.day_of_week) ?? [];
      list.push(allocation);
      map.set(allocation.day_of_week, list);
    });
    map.forEach((list, key) => {
      list.sort(
        (a, b) => (a.slot_minute_of_day ?? -1) - (b.slot_minute_of_day ?? -1),
      );
      map.set(key, list);
    });
    return map;
  }, [allocations]);

  const reviewItems = useMemo(
    () => allocations.filter((item) => item.status_snapshot !== "moved"),
    [allocations],
  );

  const weekDays = useMemo(() => {
    if (!currentWeek)
      return [] as Array<{
        index: number;
        label: string;
        date: Date;
        isToday: boolean;
      }>;
    const start = parseDateOnly(currentWeek.starts_on);
    const today = new Date();
    return DAYS.map((day) => {
      const dateOffset = day.index === 7 ? 6 : day.index - 1;
      const date = addDays(start, dateOffset);
      return {
        index: day.index,
        label: day.label,
        date,
        isToday: sameDay(date, today),
      };
    });
  }, [currentWeek]);

  const currentWeekTimeLineTop = useMemo(() => {
    if (!currentWeek) return null;
    const startDate = parseDateOnly(currentWeek.starts_on);
    const endDate = parseDateOnly(currentWeek.ends_on);
    if (now < startDate || now > addDays(endDate, 1)) return null;

    const minuteOfDay = now.getHours() * 60 + now.getMinutes();
    const minMinute = START_HOUR * 60;
    const maxMinute = END_HOUR * 60 + 45;
    if (minuteOfDay < minMinute || minuteOfDay > maxMinute) return null;

    const slotsFromStart = (minuteOfDay - minMinute) / 15;
    return slotsFromStart * SLOT_ROW_HEIGHT_PX;
  }, [currentWeek, now]);

  const refreshWeekData = useCallback(
    async (weekID: string) => {
      const [allocRes, balanceRes] = await Promise.all([
        api.get<{ data: WeekAllocation[] }>(`/weeks/${weekID}/allocations`),
        api.get<{ data: WeekBalanceSnapshot }>(`/weeks/${weekID}/balance`),
      ]);
      setAllocations(allocRes.data.data ?? []);
      setBalance(balanceRes.data.data ?? { current: [], target: [] });
    },
    [api],
  );

  const refreshWeeks = useCallback(async () => {
    const listRes = await api.get<{ data: Week[] }>("/weeks");
    const ordered = listRes.data.data ?? [];
    setWeeks(ordered);

    let week = ordered.find((item) => item.id === selectedWeekId) ?? null;
    if (!week) week = ordered.find((item) => item.status === "active") ?? null;
    if (!week)
      week = ordered.find((item) => item.status === "planning") ?? null;

    if (!week) {
      const created = await api.post<{ data: Week }>("/weeks", {});
      week = created.data.data;
      setWeeks((prev) => [week!, ...prev]);
    }

    setActiveWeek(week);
    if (week && selectedWeekId !== week.id) {
      const next = new URLSearchParams(searchParams);
      next.set("week", week.id);
      setSearchParams(next, { replace: true });
    }

    return week;
  }, [api, searchParams, selectedWeekId, setSearchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [rolesRes, goalsRes, backlogRes, week] = await Promise.all([
        api.get<{ data: Role[] }>("/roles"),
        api.get<{ data: Goal[] }>("/goals"),
        api.get<{ data: Task[] }>("/tasks?status=todo"),
        refreshWeeks(),
      ]);

      setRoles(rolesRes.data.data ?? []);
      setGoals(goalsRes.data.data ?? []);
      setBacklog(backlogRes.data.data ?? []);
      if (week) await refreshWeekData(week.id);
    } catch (e: any) {
      setError(
        e?.response?.data?.error?.message ?? "Failed to load weekly planner.",
      );
    } finally {
      setLoading(false);
    }
  }, [api, refreshWeekData, refreshWeeks]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!priorityRoleID && roles.length) {
      setPriorityRoleID(roles[0].id);
    }
  }, [priorityRoleID, roles]);

  async function refreshBacklogTasks() {
    const res = await api.get<{ data: Task[] }>("/tasks?status=todo");
    setBacklog(res.data.data ?? []);
  }

  async function switchWeek(weekID: string) {
    const week = weeks.find((item) => item.id === weekID);
    if (!week) return;
    setActiveWeek(week);
    const next = new URLSearchParams(searchParams);
    next.set("week", weekID);
    setSearchParams(next, { replace: true });
    await refreshWeekData(weekID);
  }

  async function upsertAllocation(
    taskID: string,
    dayOfWeek: number,
    lane: "daily_priority" | "timeslot",
    slotMinute?: number,
  ) {
    if (!currentWeek) return;
    await api.post(`/weeks/${currentWeek.id}/allocations`, {
      task_id: taskID,
      day_of_week: dayOfWeek,
      lane,
      slot_minute_of_day: lane === "timeslot" ? slotMinute : null,
    });
    await Promise.all([
      refreshWeekData(currentWeek.id),
      api
        .get<{ data: Task[] }>("/tasks?status=todo")
        .then((res) => setBacklog(res.data.data ?? [])),
    ]);
  }

  async function removeAllocation(allocationID: string) {
    if (!currentWeek) return;
    await api.delete(`/weeks/${currentWeek.id}/allocations/${allocationID}`);
    await refreshWeekData(currentWeek.id);
  }

  async function completeTask(taskID: string) {
    if (!currentWeek) return;
    await api.patch(`/tasks/${taskID}/complete`);
    await Promise.all([refreshWeekData(currentWeek.id), refreshBacklogTasks()]);
  }

  async function updateTaskPriorityTag(taskID: string, enable: boolean) {
    const known = backlog.find((task) => task.id === taskID);
    const task = known ?? (await api.get<Task>(`/tasks/${taskID}`)).data;
    const tags = [...(task.context_tags ?? [])];
    const hasTag = tags.includes(WEEK_PRIORITY_TAG);
    if (enable && !hasTag) tags.push(WEEK_PRIORITY_TAG);
    if (!enable && hasTag) {
      const idx = tags.indexOf(WEEK_PRIORITY_TAG);
      tags.splice(idx, 1);
    }
    await api.put(`/tasks/${taskID}`, { context_tags: tags });
  }

  async function moveTaskToBacklog(taskID: string) {
    if (!currentWeek) return;
    const allocation = allocationByTaskID.get(taskID);
    if (allocation) {
      await api.delete(`/weeks/${currentWeek.id}/allocations/${allocation.id}`);
    }
    await updateTaskPriorityTag(taskID, false);
    await Promise.all([refreshWeekData(currentWeek.id), refreshBacklogTasks()]);
  }

  async function moveTaskToWeekPriorities(taskID: string) {
    if (!currentWeek) return;
    const allocation = allocationByTaskID.get(taskID);
    if (allocation) {
      await api.delete(`/weeks/${currentWeek.id}/allocations/${allocation.id}`);
    }
    await updateTaskPriorityTag(taskID, true);
    await Promise.all([refreshWeekData(currentWeek.id), refreshBacklogTasks()]);
  }

  async function createPriorityTask() {
    if (!priorityInput.trim() || !priorityRoleID) return;
    await api.post("/tasks", {
      title: priorityInput.trim(),
      description: "",
      primary_role_id: priorityRoleID,
      goal_id: null,
      task_type: "one_time",
      impact: 4,
      effort: 3,
      estimated_minutes: null,
      context_tags: [WEEK_PRIORITY_TAG],
      deadline: null,
      soft_deadline: null,
      scheduled_date: null,
    });
    setPriorityInput("");
    await refreshBacklogTasks();
  }

  async function openTaskPanel(taskID: string) {
    try {
      let task = backlog.find((item) => item.id === taskID) ?? null;
      if (!task) {
        const res = await api.get<{ data: Task }>(`/tasks/${taskID}`);
        task = res.data.data;
      }
      if (!task) return;
      setSelectedTaskID(task.id);
      setTaskForm({
        title: task.title,
        description: task.description,
        primary_role_id: task.primary_role_id,
        goal_id: task.goal_id ?? "",
        impact: task.impact,
        effort: task.effort,
        estimated_minutes:
          task.estimated_minutes != null ? String(task.estimated_minutes) : "",
        scheduled_date: toDateInput(task.scheduled_date),
        soft_deadline: toDateInput(task.soft_deadline),
        deadline: toDateInput(task.deadline),
      });
      setTaskPanelOpen(true);
    } catch {
      setError("Failed to load selected task details.");
    }
  }

  async function saveTaskDetails() {
    if (
      !currentWeek ||
      !selectedTaskID ||
      !taskForm.title.trim() ||
      !taskForm.primary_role_id
    )
      return;
    setTaskSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: taskForm.title.trim(),
        description: taskForm.description,
        primary_role_id: taskForm.primary_role_id,
        goal_id: taskForm.goal_id || null,
        impact: taskForm.impact,
        effort: taskForm.effort,
        estimated_minutes: taskForm.estimated_minutes
          ? Number(taskForm.estimated_minutes)
          : null,
        scheduled_date: taskForm.scheduled_date || null,
        soft_deadline: taskForm.soft_deadline || null,
        deadline: taskForm.deadline || null,
      };
      if (!taskForm.scheduled_date) payload.clear_scheduled_date = true;
      if (!taskForm.soft_deadline) payload.clear_soft_deadline = true;
      if (!taskForm.deadline) payload.clear_deadline = true;
      await api.put(`/tasks/${selectedTaskID}`, payload);
      await Promise.all([
        refreshWeekData(currentWeek.id),
        api
          .get<{ data: Task[] }>("/tasks?status=todo")
          .then((res) => setBacklog(res.data.data ?? [])),
      ]);
      setTaskPanelOpen(false);
    } finally {
      setTaskSaving(false);
    }
  }

  async function transition(
    action: "start" | "enter-review" | "close" | "reopen",
  ) {
    if (!currentWeek) return;
    try {
      await api.post(`/weeks/${currentWeek.id}/${action}`);
      await load();
    } catch (e: any) {
      setError(
        e?.response?.data?.error?.message ??
          `Failed to ${action.replace("-", " ")} week.`,
      );
    }
  }

  async function applyReviewAction(action: WeekReviewAction) {
    if (!currentWeek) return;
    const taskIDs = Object.keys(reviewSelected).filter(
      (key) => reviewSelected[key],
    );
    if (!taskIDs.length) return;
    await api.post(`/weeks/${currentWeek.id}/review/actions`, {
      action,
      task_ids: taskIDs,
    });
    setReviewSelected({});
    await Promise.all([
      refreshWeekData(currentWeek.id),
      api
        .get<{ data: Task[] }>("/tasks?status=todo")
        .then((res) => setBacklog(res.data.data ?? [])),
    ]);
  }

  function onDragStartTask(ev: React.DragEvent, taskID: string) {
    ev.dataTransfer.setData("task_id", taskID);
  }

  function onDrop(
    ev: React.DragEvent,
    day: number,
    lane: "daily_priority" | "timeslot",
    slotMinute?: number,
  ) {
    ev.preventDefault();
    const taskID = ev.dataTransfer.getData("task_id");
    if (!taskID) return;
    void upsertAllocation(taskID, day, lane, slotMinute);
  }

  function onDropToBacklog(ev: React.DragEvent) {
    ev.preventDefault();
    const taskID = ev.dataTransfer.getData("task_id");
    if (!taskID) return;
    void moveTaskToBacklog(taskID);
  }

  function onDropToWeekPriorities(ev: React.DragEvent) {
    ev.preventDefault();
    const taskID = ev.dataTransfer.getData("task_id");
    if (!taskID) return;
    void moveTaskToWeekPriorities(taskID);
  }

  const mergedRadar = mergeRadarData(balance.current, balance.target);

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[1600px] mx-auto">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            🗓️ Weekly Planner
          </h1>
          <p className="text-sm text-gray-500">
            Plan on Sunday, execute during the week, review and carry over.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/weeks"
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
          >
            Weeks section
          </Link>
          <select
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white"
            value={currentWeek?.id ?? ""}
            onChange={(e) => switchWeek(e.target.value)}
          >
            {weeks.map((week) => (
              <option key={week.id} value={week.id}>
                {weekLabel(week)}
              </option>
            ))}
          </select>
          {currentWeek?.status === "planning" && (
            <button
              className="px-3 py-2 text-sm rounded-lg bg-indigo-600 text-white"
              onClick={() => transition("start")}
            >
              Start week
            </button>
          )}
          {currentWeek?.status === "active" && (
            <button
              className="px-3 py-2 text-sm rounded-lg bg-amber-600 text-white"
              onClick={() => transition("enter-review")}
            >
              Review week
            </button>
          )}
          {currentWeek?.status === "review" && (
            <button
              className="px-3 py-2 text-sm rounded-lg bg-emerald-600 text-white"
              onClick={() => transition("close")}
            >
              Close week
            </button>
          )}
          {currentWeek?.status === "closed" && (
            <button
              className="px-3 py-2 text-sm rounded-lg bg-slate-700 text-white"
              onClick={() => transition("reopen")}
            >
              Re-open week
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !currentWeek ? (
        <p className="text-sm text-gray-500">No week selected.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-6 gap-4 items-start">
            <section className="xl:col-span-1 space-y-3 h-[78vh]">
              <div className="bg-white rounded-xl border border-gray-200 p-3 h-[49%] overflow-auto">
                <h2 className="font-semibold text-gray-900 mb-2">
                  Roles & Goals
                </h2>
                <div className="space-y-2.5">
                  {roles.map((role) => (
                    <div
                      key={role.id}
                      className="rounded-lg border border-gray-100 p-2"
                    >
                      <p className="font-medium text-xs text-gray-900">
                        {role.name}
                      </p>
                      <ul className="mt-1 space-y-1">
                        {(groupedGoals.get(role.id) ?? [])
                          .slice(0, 4)
                          .map((goal) => (
                            <li
                              key={goal.id}
                              className="text-[11px] text-gray-600 truncate"
                            >
                              • {goal.title}
                            </li>
                          ))}
                        {(groupedGoals.get(role.id) ?? []).length === 0 && (
                          <li className="text-[11px] text-gray-400">
                            No goals yet
                          </li>
                        )}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-3 h-[49%] overflow-auto">
                <h2 className="font-semibold text-gray-900">
                  Week priorities (tasks)
                </h2>
                <p className="text-[11px] text-gray-500">
                  Create or drop tasks here. Drag to backlog to remove from
                  weekly focus.
                </p>
                <div className="mt-2 grid grid-cols-[1fr_110px_52px] gap-1.5">
                  <input
                    value={priorityInput}
                    onChange={(e) => setPriorityInput(e.target.value)}
                    placeholder="New priority task"
                    className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg"
                  />
                  <select
                    value={priorityRoleID}
                    onChange={(e) => setPriorityRoleID(e.target.value)}
                    className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg"
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={createPriorityTask}
                    className="px-2 py-1.5 text-xs rounded-lg bg-indigo-600 text-white"
                  >
                    Add
                  </button>
                </div>

                <div
                  className="mt-2.5 space-y-1.5 min-h-20 rounded-lg border border-dashed border-indigo-300 bg-indigo-50 p-1.5"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDropToWeekPriorities}
                >
                  {weekPriorityTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => onDragStartTask(e, task.id)}
                      className="rounded-md border border-indigo-200 bg-white p-1.5"
                    >
                      <button
                        className="text-xs font-medium text-gray-800 truncate text-left w-full"
                        onClick={() => openTaskPanel(task.id)}
                      >
                        {task.title}
                      </button>
                      <div className="mt-0.5 flex items-center justify-between text-[10px]">
                        <button
                          className="text-emerald-700"
                          onClick={() => completeTask(task.id)}
                          title="Mark done"
                        >
                          ✓
                        </button>
                        <button
                          className="text-gray-600"
                          onClick={() => moveTaskToBacklog(task.id)}
                          title="Move to backlog"
                        >
                          ↶
                        </button>
                        <button
                          className="text-indigo-600"
                          onClick={() => openTaskPanel(task.id)}
                          title="View/edit"
                        >
                          ✎
                        </button>
                      </div>
                    </div>
                  ))}
                  {weekPriorityTasks.length === 0 && (
                    <p className="text-[11px] text-indigo-600/80">
                      Drop tasks here to mark them as week priorities.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="xl:col-span-4 bg-white rounded-xl border border-gray-200 p-3 overflow-auto h-[78vh]">
              <div className="min-w-[1040px] h-full">
                <div className="grid grid-cols-[68px_repeat(7,minmax(0,1fr))] border-b border-gray-200 bg-white sticky top-0 z-10">
                  <div className="px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Time
                  </div>
                  {weekDays.map((day) => (
                    <div
                      key={day.index}
                      className={`px-2 py-1.5 border-l border-gray-100 ${day.isToday ? "bg-indigo-50" : ""}`}
                    >
                      <p
                        className={`text-xs font-semibold ${day.isToday ? "text-indigo-700" : "text-gray-700"}`}
                      >
                        {day.label}
                      </p>
                      <p
                        className={`text-[10px] ${day.isToday ? "text-indigo-600" : "text-gray-500"}`}
                      >
                        {day.date.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-[68px_repeat(7,minmax(0,1fr))] border-b border-gray-200 bg-gray-50/60">
                  <div className="px-2 py-2 text-[10px] text-indigo-700 uppercase tracking-wide font-semibold">
                    Daily
                  </div>
                  {weekDays.map((day) => {
                    const daily = dailyByDay.get(day.index) ?? [];
                    return (
                      <div
                        key={day.index}
                        className="min-h-28 max-h-28 overflow-auto p-1.5 border-l border-gray-100 rounded-none"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => onDrop(e, day.index, "daily_priority")}
                      >
                        <div className="space-y-1">
                          {daily.map((item) => (
                            <div
                              key={item.id}
                              draggable
                              onDragStart={(e) =>
                                onDragStartTask(e, item.task_id)
                              }
                              className="rounded bg-white border border-indigo-200 p-1"
                            >
                              <button
                                className="text-[10px] text-left w-full truncate font-medium text-gray-800"
                                onClick={() => openTaskPanel(item.task_id)}
                              >
                                {item.task_title}
                              </button>
                              <div className="mt-0.5 flex items-center justify-between text-[9px]">
                                <button
                                  className="text-emerald-700"
                                  onClick={() => completeTask(item.task_id)}
                                  title="Done"
                                >
                                  ✓
                                </button>
                                <button
                                  className="text-gray-600"
                                  onClick={() => removeAllocation(item.id)}
                                  title="Backlog"
                                >
                                  ↶
                                </button>
                                <button
                                  className="text-indigo-600"
                                  onClick={() => openTaskPanel(item.task_id)}
                                  title="View/edit"
                                >
                                  ✎
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="relative">
                  {currentWeekTimeLineTop != null && (
                    <div
                      className="absolute left-[68px] right-0 z-20 pointer-events-none"
                      style={{ top: `${currentWeekTimeLineTop}px` }}
                    >
                      <div className="h-px bg-red-500" />
                      <div className="absolute -top-2 -left-14 text-[9px] font-semibold text-red-600 bg-white px-1 rounded">
                        {now.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  )}

                  {quarterSlots.map((slot) => (
                    <div
                      key={slot}
                      className="grid grid-cols-[68px_repeat(7,minmax(0,1fr))] border-b border-gray-100 min-h-[22px]"
                    >
                      <div className="px-2 py-0.5 text-[10px] text-gray-500 bg-white/80">
                        {slot % 60 === 0
                          ? `${String(Math.floor(slot / 60)).padStart(2, "0")}:00`
                          : ""}
                      </div>
                      {weekDays.map((day) => {
                        const key = `${day.index}-${slot}`;
                        const slotItems = slotByDay.get(key) ?? [];
                        return (
                          <div
                            key={key}
                            className={`border-l border-dashed border-gray-100 px-1 py-0.5 ${day.isToday ? "bg-indigo-50/30" : ""}`}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) =>
                              onDrop(e, day.index, "timeslot", slot)
                            }
                          >
                            {slotItems.map((item) => (
                              <div
                                key={item.id}
                                draggable
                                onDragStart={(e) =>
                                  onDragStartTask(e, item.task_id)
                                }
                                className="rounded bg-indigo-100 border border-indigo-200 px-1 py-0.5 text-[10px] text-indigo-900 mb-0.5"
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <button
                                    className="truncate text-left"
                                    onClick={() => openTaskPanel(item.task_id)}
                                  >
                                    {item.task_title}
                                  </button>
                                  <div className="flex items-center gap-1">
                                    <button
                                      className="text-emerald-700"
                                      onClick={() => completeTask(item.task_id)}
                                      title="Done"
                                    >
                                      ✓
                                    </button>
                                    <button
                                      className="text-gray-600"
                                      onClick={() => removeAllocation(item.id)}
                                      title="Backlog"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="xl:col-span-1 space-y-3 h-[78vh]">
              <div className="bg-white rounded-xl border border-gray-200 p-3 h-[36%]">
                <div className="flex flex-col gap-1 mb-2">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">
                    Balance Radar
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-600">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                      Target
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-600 inline-block" />
                      Current
                    </span>
                  </div>
                </div>
                {mergedRadar.length >= 3 ? (
                  <ResponsiveContainer width="100%" height={190}>
                    <RadarChart data={mergedRadar}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="role" tick={{ fontSize: 10 }} />
                      <Radar
                        dataKey="target"
                        name="Target"
                        stroke="#6366f1"
                        fill="#6366f1"
                        fillOpacity={0.12}
                      />
                      <Radar
                        dataKey="current"
                        name="Current"
                        stroke="#16a34a"
                        fill="#16a34a"
                        fillOpacity={0.14}
                      />
                      <Tooltip
                        formatter={(value) => [
                          `${Number(value ?? 0).toFixed(0)}%`,
                          "Balance",
                        ]}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-gray-400">
                    Create at least 3 roles to see radar guidance.
                  </p>
                )}
              </div>

              <div
                className="bg-white rounded-xl border border-gray-200 p-3 h-[62%] overflow-auto"
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDropToBacklog}
              >
                <h2 className="font-semibold text-gray-900">
                  Backlog quick add
                </h2>
                <div className="mt-2 space-y-2">
                  <select
                    value={backlogRoleFilter}
                    onChange={(e) => setBacklogRoleFilter(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg"
                  >
                    <option value="">All roles</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  <label className="text-xs text-gray-600 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={importantOnly}
                      onChange={(e) => setImportantOnly(e.target.checked)}
                    />
                    Important only (impact ≥ 4)
                  </label>
                </div>
                <div className="mt-3 space-y-1.5 max-h-[48vh] overflow-auto">
                  {visibleBacklog.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => onDragStartTask(e, task.id)}
                      className="rounded-lg border border-gray-200 p-1.5 bg-gray-50 cursor-grab"
                    >
                      <button
                        className="text-xs font-medium text-gray-800 truncate text-left w-full"
                        onClick={() => openTaskPanel(task.id)}
                      >
                        {task.title}
                      </button>
                      <div className="text-[10px] text-gray-500 mt-0.5 flex items-center justify-between">
                        <span>
                          Impact {task.impact} · Effort {task.effort}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            className="text-emerald-700"
                            onClick={() => completeTask(task.id)}
                            title="Mark done"
                          >
                            ✓
                          </button>
                          <button
                            className="text-indigo-700"
                            onClick={() => moveTaskToWeekPriorities(task.id)}
                            title="Move to week priorities"
                          >
                            ★
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {taskPanelOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/20"
              onClick={() => setTaskPanelOpen(false)}
            >
              <aside
                className="absolute right-0 top-0 h-full w-full max-w-md bg-white border-l border-gray-200 shadow-xl p-4 overflow-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      Task details
                    </h3>
                    <p className="text-xs text-gray-500">
                      Universal quick view/edit
                    </p>
                  </div>
                  <button
                    className="text-gray-500"
                    onClick={() => setTaskPanelOpen(false)}
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-500">Title</label>
                    <input
                      value={taskForm.title}
                      onChange={(e) =>
                        setTaskForm((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">Description</label>
                    <textarea
                      value={taskForm.description}
                      onChange={(e) =>
                        setTaskForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">Role</label>
                      <select
                        value={taskForm.primary_role_id}
                        onChange={(e) =>
                          setTaskForm((prev) => ({
                            ...prev,
                            primary_role_id: e.target.value,
                          }))
                        }
                        className="mt-1 w-full px-2 py-2 text-sm border border-gray-300 rounded-lg"
                      >
                        <option value="">Role…</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-gray-500">Goal</label>
                      <select
                        value={taskForm.goal_id}
                        onChange={(e) =>
                          setTaskForm((prev) => ({
                            ...prev,
                            goal_id: e.target.value,
                          }))
                        }
                        className="mt-1 w-full px-2 py-2 text-sm border border-gray-300 rounded-lg"
                      >
                        <option value="">No goal</option>
                        {(
                          groupedGoals.get(taskForm.primary_role_id) ?? goals
                        ).map((goal) => (
                          <option key={goal.id} value={goal.id}>
                            {goal.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">Impact</label>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={taskForm.impact}
                        onChange={(e) =>
                          setTaskForm((prev) => ({
                            ...prev,
                            impact: Number(e.target.value) || 1,
                          }))
                        }
                        className="mt-1 w-full px-2 py-2 text-sm border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Effort</label>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={taskForm.effort}
                        onChange={(e) =>
                          setTaskForm((prev) => ({
                            ...prev,
                            effort: Number(e.target.value) || 1,
                          }))
                        }
                        className="mt-1 w-full px-2 py-2 text-sm border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Mins</label>
                      <input
                        type="number"
                        min={1}
                        value={taskForm.estimated_minutes}
                        onChange={(e) =>
                          setTaskForm((prev) => ({
                            ...prev,
                            estimated_minutes: e.target.value,
                          }))
                        }
                        className="mt-1 w-full px-2 py-2 text-sm border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">
                        Scheduled date
                      </label>
                      <input
                        type="date"
                        value={taskForm.scheduled_date}
                        onChange={(e) =>
                          setTaskForm((prev) => ({
                            ...prev,
                            scheduled_date: e.target.value,
                          }))
                        }
                        className="mt-1 w-full px-2 py-2 text-sm border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500">
                          Soft deadline
                        </label>
                        <input
                          type="date"
                          value={taskForm.soft_deadline}
                          onChange={(e) =>
                            setTaskForm((prev) => ({
                              ...prev,
                              soft_deadline: e.target.value,
                            }))
                          }
                          className="mt-1 w-full px-2 py-2 text-sm border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">
                          Hard deadline
                        </label>
                        <input
                          type="date"
                          value={taskForm.deadline}
                          onChange={(e) =>
                            setTaskForm((prev) => ({
                              ...prev,
                              deadline: e.target.value,
                            }))
                          }
                          className="mt-1 w-full px-2 py-2 text-sm border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                    <p>
                      Role: {roleMap.get(taskForm.primary_role_id)?.name ?? "—"}
                    </p>
                    <p>
                      Goal:{" "}
                      {taskForm.goal_id
                        ? (goalMap.get(taskForm.goal_id)?.title ?? "—")
                        : "None"}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      className="px-3 py-1.5 text-xs rounded-lg border border-gray-300"
                      onClick={() => {
                        if (selectedTaskID) {
                          void completeTask(selectedTaskID);
                          setTaskPanelOpen(false);
                        }
                      }}
                    >
                      Mark done
                    </button>
                    <button
                      className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 text-white disabled:opacity-60"
                      onClick={saveTaskDetails}
                      disabled={
                        taskSaving ||
                        !taskForm.title.trim() ||
                        !taskForm.primary_role_id
                      }
                    >
                      {taskSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          )}

          {currentWeek.status === "review" && (
            <section className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="font-semibold text-gray-900">Week review</h2>
              <p className="text-xs text-gray-500 mb-3">
                Select tasks and quickly mark done, move to next week, or send
                back to backlog.
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white"
                  onClick={() => applyReviewAction("done")}
                >
                  Mark done
                </button>
                <button
                  className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white"
                  onClick={() => applyReviewAction("move_next_week")}
                >
                  Move to next week
                </button>
                <button
                  className="px-3 py-1.5 text-sm rounded-lg bg-gray-700 text-white"
                  onClick={() => applyReviewAction("backlog")}
                >
                  Send to backlog
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {reviewItems.map((item) => (
                  <label
                    key={item.id}
                    className="rounded-lg border border-gray-200 p-2 flex items-start gap-2"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(reviewSelected[item.task_id])}
                      onChange={(e) =>
                        setReviewSelected((prev) => ({
                          ...prev,
                          [item.task_id]: e.target.checked,
                        }))
                      }
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 truncate">
                        {item.task_title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {DAYS[item.day_of_week - 1]?.label} ·{" "}
                        {item.lane === "timeslot"
                          ? fmtTime(item.slot_minute_of_day)
                          : "Daily priority"}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
