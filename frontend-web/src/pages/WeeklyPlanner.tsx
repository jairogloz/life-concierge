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
const WEEK_PRIORITY_TAG_PREFIX = "week_priority:";
const SLOT_ROW_HEIGHT_PX = 22;
const DAILY_ROW_HEIGHT_PX = 28;
const DAILY_MIN_ROWS = 2;
const DAILY_MAX_ROWS = 4;

function weekPriorityTagForWeek(weekID: string) {
  return `${WEEK_PRIORITY_TAG_PREFIX}${weekID}`;
}

function taskROI(task: Task) {
  return task.impact / Math.max(task.effort, 1);
}

const HIDE_SCROLLBAR_STYLE = {
  msOverflowStyle: "none",
  scrollbarWidth: "none",
} as const;

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

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toApiDateTime(value?: string | null) {
  if (!value) return null;
  return `${value}T00:00:00Z`;
}

function toApiDateTimeWithTime(
  dateValue?: string | null,
  timeValue?: string | null,
) {
  if (!dateValue) return null;
  if (!timeValue) return `${dateValue}T00:00:00Z`;
  return `${dateValue}T${timeValue}:00Z`;
}

function toTimeInput(value?: string | null) {
  if (!value) return "";
  const tIndex = value.indexOf("T");
  if (tIndex < 0 || value.length < tIndex + 6) return "";
  return value.slice(tIndex + 1, tIndex + 6);
}

function parseTimeInputToMinute(value?: string | null) {
  if (!value) return null;
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function minuteToTimeInput(minuteOfDay?: number | null) {
  if (minuteOfDay == null) return "";
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
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
    start_time: "",
    soft_deadline: "",
    deadline: "",
  });
  const [taskSaving, setTaskSaving] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addTaskSaving, setAddTaskSaving] = useState(false);
  const [addTaskSlot, setAddTaskSlot] = useState<{
    dayOfWeek: number;
    slotMinute: number;
  } | null>(null);
  const [addTaskForm, setAddTaskForm] = useState({
    title: "",
    description: "",
    primary_role_id: "",
    goal_id: "",
    impact: 3,
    effort: 3,
    estimated_minutes: "",
    scheduled_date: "",
    start_time: "",
    is_week_priority: false,
  });
  const [now, setNow] = useState(new Date());

  const selectedWeekId = searchParams.get("week") || "";

  const currentWeek = useMemo(() => {
    if (!weeks.length) return activeWeek;
    if (selectedWeekId) {
      return weeks.find((week) => week.id === selectedWeekId) || activeWeek;
    }
    return activeWeek;
  }, [weeks, activeWeek, selectedWeekId]);

  const currentWeekPriorityTag = useMemo(() => {
    if (!currentWeek) return "";
    return weekPriorityTagForWeek(currentWeek.id);
  }, [currentWeek]);

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

  const allocatedTaskIDs = useMemo(() => {
    const ids = new Set<string>();
    allocations.forEach((allocation) => ids.add(allocation.task_id));
    return ids;
  }, [allocations]);

  const visibleBacklog = useMemo(() => {
    return backlog
      .filter((task) => {
        const tags = task.context_tags ?? [];
        if (currentWeekPriorityTag && tags.includes(currentWeekPriorityTag))
          return false;
        if (
          currentWeek?.status === "active" &&
          tags.includes(WEEK_PRIORITY_TAG)
        )
          return false;
        if (allocatedTaskIDs.has(task.id)) return false;
        if (backlogRoleFilter && task.primary_role_id !== backlogRoleFilter)
          return false;
        if (importantOnly && task.impact < 4) return false;
        if (task.status === "done") return false;
        if (task.status === "archived") return false;
        return true;
      })
      .sort((a, b) => {
        const byROI = taskROI(b) - taskROI(a);
        if (byROI !== 0) return byROI;
        if (b.impact !== a.impact) return b.impact - a.impact;
        if (a.effort !== b.effort) return a.effort - b.effort;
        return a.title.localeCompare(b.title);
      });
  }, [
    backlog,
    currentWeek,
    currentWeekPriorityTag,
    allocatedTaskIDs,
    backlogRoleFilter,
    importantOnly,
  ]);

  const weekPriorityTasks = useMemo(() => {
    return backlog
      .filter((task) => {
        const tags = task.context_tags ?? [];
        const inCurrentWeek =
          currentWeekPriorityTag && tags.includes(currentWeekPriorityTag);
        const inLegacyActiveWeek =
          currentWeek?.status === "active" && tags.includes(WEEK_PRIORITY_TAG);
        if (!inCurrentWeek && !inLegacyActiveWeek) return false;
        if (allocatedTaskIDs.has(task.id)) return false;
        return task.status !== "archived";
      })
      .sort((a, b) => {
        const aDone = a.status === "done";
        const bDone = b.status === "done";
        if (aDone === bDone) return 0;
        return aDone ? 1 : -1;
      });
  }, [backlog, currentWeek, currentWeekPriorityTag, allocatedTaskIDs]);

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
    map.forEach((list, key) => {
      list.sort((a, b) => {
        const aDone = a.task_status === "done";
        const bDone = b.task_status === "done";
        if (aDone === bDone) return a.task_title.localeCompare(b.task_title);
        return aDone ? 1 : -1;
      });
      map.set(key, list);
    });
    return map;
  }, [allocations]);

  const dailyRows = useMemo(() => {
    const maxItemsInADay = Math.max(
      ...DAYS.map((day) => (dailyByDay.get(day.index) ?? []).length),
      0,
    );
    return Math.min(Math.max(maxItemsInADay, DAILY_MIN_ROWS), DAILY_MAX_ROWS);
  }, [dailyByDay]);

  const dailyHeightPx = useMemo(
    () => dailyRows * DAILY_ROW_HEIGHT_PX,
    [dailyRows],
  );

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
      const dateOffset = day.index === 7 ? 0 : day.index;
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
        api.get<{ data: Task[] }>("/tasks"),
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
    if (!addTaskForm.primary_role_id && roles.length) {
      setAddTaskForm((prev) => ({ ...prev, primary_role_id: roles[0].id }));
    }
  }, [addTaskForm.primary_role_id, roles]);

  function dateForWeekDay(dayOfWeek: number) {
    if (!currentWeek) return "";
    const start = parseDateOnly(currentWeek.starts_on);
    const offset = dayOfWeek === 7 ? 0 : dayOfWeek;
    return formatDateOnly(addDays(start, offset));
  }

  function openAddTask(
    slot?: { dayOfWeek: number; slotMinute: number },
    preselectWeekPriority = false,
  ) {
    setAddTaskSlot(slot ?? null);
    const isWeekPriority = preselectWeekPriority && !slot;
    setAddTaskForm({
      title: "",
      description: "",
      primary_role_id: roles[0]?.id ?? "",
      goal_id: "",
      impact: 3,
      effort: 3,
      estimated_minutes: slot ? "60" : "",
      scheduled_date: isWeekPriority
        ? ""
        : slot
          ? dateForWeekDay(slot.dayOfWeek)
          : "",
      start_time: isWeekPriority
        ? ""
        : slot
          ? minuteToTimeInput(slot.slotMinute)
          : "",
      is_week_priority: isWeekPriority,
    });
    setAddTaskOpen(true);
  }

  async function refreshBacklogTasks() {
    const res = await api.get<{ data: Task[] }>("/tasks");
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
        .get<{ data: Task[] }>("/tasks")
        .then((res) => setBacklog(res.data.data ?? [])),
    ]);
  }

  async function removeAllocation(allocationID: string) {
    if (!currentWeek) return;
    await api.delete(`/weeks/${currentWeek.id}/allocations/${allocationID}`);
    await refreshWeekData(currentWeek.id);
  }

  async function setTaskCompleted(taskID: string, completed: boolean) {
    if (!currentWeek) return;
    await api.put(`/tasks/${taskID}`, {
      status: completed ? "done" : "todo",
    });
    await Promise.all([refreshWeekData(currentWeek.id), refreshBacklogTasks()]);
  }

  async function updateTaskPriorityTag(
    taskID: string,
    weekID: string,
    enable: boolean,
  ) {
    const known = backlog.find((task) => task.id === taskID);
    const task = known ?? (await api.get<Task>(`/tasks/${taskID}`)).data;
    const weekTag = weekPriorityTagForWeek(weekID);
    let tags = [...(task.context_tags ?? [])];
    tags = tags.filter((tag) => tag !== WEEK_PRIORITY_TAG);

    if (enable) {
      tags = tags.filter((tag) => !tag.startsWith(WEEK_PRIORITY_TAG_PREFIX));
      if (!tags.includes(weekTag)) tags.push(weekTag);
    } else {
      tags = tags.filter((tag) => tag !== weekTag);
    }

    await api.put(`/tasks/${taskID}`, { context_tags: tags });
  }

  async function moveTaskToBacklog(taskID: string) {
    if (!currentWeek) return;
    const allocation = allocationByTaskID.get(taskID);
    if (allocation) {
      await api.delete(`/weeks/${currentWeek.id}/allocations/${allocation.id}`);
    }
    await updateTaskPriorityTag(taskID, currentWeek.id, false);
    await Promise.all([refreshWeekData(currentWeek.id), refreshBacklogTasks()]);
  }

  async function moveTaskToWeekPriorities(taskID: string) {
    if (!currentWeek) return;
    const allocation = allocationByTaskID.get(taskID);
    if (allocation) {
      await api.delete(`/weeks/${currentWeek.id}/allocations/${allocation.id}`);
    }
    await updateTaskPriorityTag(taskID, currentWeek.id, true);
    await Promise.all([refreshWeekData(currentWeek.id), refreshBacklogTasks()]);
  }

  async function createTaskFromPlanner() {
    if (
      !currentWeek ||
      !addTaskForm.title.trim() ||
      !addTaskForm.primary_role_id
    )
      return;
    setAddTaskSaving(true);
    try {
      const createRes = await api.post<Task | { data: Task }>("/tasks", {
        title: addTaskForm.title.trim(),
        description: addTaskForm.description,
        primary_role_id: addTaskForm.primary_role_id,
        goal_id: addTaskForm.goal_id || null,
        task_type: "one_time",
        impact: addTaskForm.impact,
        effort: addTaskForm.effort,
        estimated_minutes: addTaskSlot
          ? 60
          : addTaskForm.estimated_minutes
            ? Number(addTaskForm.estimated_minutes)
            : null,
        context_tags:
          addTaskForm.is_week_priority && currentWeek
            ? [weekPriorityTagForWeek(currentWeek.id)]
            : [],
        deadline: null,
        soft_deadline: null,
        scheduled_date: addTaskForm.is_week_priority
          ? null
          : toApiDateTimeWithTime(
              addTaskForm.scheduled_date,
              addTaskForm.start_time,
            ),
      });

      const createdTask =
        "data" in createRes.data
          ? createRes.data.data
          : (createRes.data as Task);
      if (addTaskSlot && createdTask?.id) {
        await api.post(`/weeks/${currentWeek.id}/allocations`, {
          task_id: createdTask.id,
          day_of_week: addTaskSlot.dayOfWeek,
          lane: "timeslot",
          slot_minute_of_day: addTaskSlot.slotMinute,
        });
      } else if (createdTask?.id && addTaskForm.scheduled_date) {
        const scheduled = parseDateOnly(addTaskForm.scheduled_date);
        const weekStart = parseDateOnly(currentWeek.starts_on);
        const weekEnd = parseDateOnly(currentWeek.ends_on);
        if (scheduled >= weekStart && scheduled <= weekEnd) {
          const dayOfWeek = scheduled.getDay() === 0 ? 7 : scheduled.getDay();
          const slotMinute = parseTimeInputToMinute(addTaskForm.start_time);
          await api.post(`/weeks/${currentWeek.id}/allocations`, {
            task_id: createdTask.id,
            day_of_week: dayOfWeek,
            lane: slotMinute != null ? "timeslot" : "daily_priority",
            slot_minute_of_day: slotMinute,
          });
        }
      }

      await Promise.all([
        refreshBacklogTasks(),
        refreshWeekData(currentWeek.id),
      ]);
      setAddTaskOpen(false);
      setAddTaskSlot(null);
    } catch (e: any) {
      setError(
        e?.response?.data?.error?.message ??
          "Failed to create task from weekly planner.",
      );
    } finally {
      setAddTaskSaving(false);
    }
  }

  async function openTaskPanel(taskID: string) {
    try {
      let task = backlog.find((item) => item.id === taskID) ?? null;
      if (!task) {
        const res = await api.get<{ data: Task }>(`/tasks/${taskID}`);
        task = res.data.data;
      }
      if (!task) return;
      const allocation = currentWeek
        ? allocationByTaskID.get(task.id)
        : undefined;
      const allocationDate = allocation
        ? dateForWeekDay(allocation.day_of_week)
        : "";
      const allocationTime =
        allocation?.lane === "timeslot"
          ? minuteToTimeInput(allocation.slot_minute_of_day)
          : "";
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
        scheduled_date: allocationDate || toDateInput(task.scheduled_date),
        start_time: allocationTime || toTimeInput(task.scheduled_date),
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
        scheduled_date: toApiDateTimeWithTime(
          taskForm.scheduled_date,
          taskForm.start_time,
        ),
        soft_deadline: toApiDateTime(taskForm.soft_deadline),
        deadline: toApiDateTime(taskForm.deadline),
      };
      if (!taskForm.scheduled_date) payload.clear_scheduled_date = true;
      if (!taskForm.soft_deadline) payload.clear_soft_deadline = true;
      if (!taskForm.deadline) payload.clear_deadline = true;
      await api.put(`/tasks/${selectedTaskID}`, payload);

      const allocation = allocationByTaskID.get(selectedTaskID);
      if (allocation) {
        let dayOfWeek = allocation.day_of_week;
        if (taskForm.scheduled_date) {
          const scheduled = parseDateOnly(taskForm.scheduled_date);
          const weekStart = parseDateOnly(currentWeek.starts_on);
          const weekEnd = parseDateOnly(currentWeek.ends_on);
          if (scheduled >= weekStart && scheduled <= weekEnd) {
            dayOfWeek = scheduled.getDay() === 0 ? 7 : scheduled.getDay();
          }
        }
        const slotMinute = parseTimeInputToMinute(taskForm.start_time);
        await api.post(`/weeks/${currentWeek.id}/allocations`, {
          task_id: selectedTaskID,
          day_of_week: dayOfWeek,
          lane: slotMinute != null ? "timeslot" : "daily_priority",
          slot_minute_of_day: slotMinute,
        });
      }

      await Promise.all([
        refreshWeekData(currentWeek.id),
        api
          .get<{ data: Task[] }>("/tasks")
          .then((res) => setBacklog(res.data.data ?? [])),
      ]);
      setTaskPanelOpen(false);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? "Failed to save task.");
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
        .get<{ data: Task[] }>("/tasks")
        .then((res) => setBacklog(res.data.data ?? [])),
    ]);
  }

  function renderPlannerTaskCard(props: {
    taskID: string;
    title: string;
    checked: boolean;
    draggable?: boolean;
    className?: string;
    onToggle: (checked: boolean) => void;
  }) {
    return (
      <div
        draggable={Boolean(props.draggable)}
        onDragStart={
          props.draggable ? (e) => onDragStartTask(e, props.taskID) : undefined
        }
        className={`rounded-md border border-gray-200 bg-white p-1.5 ${props.className ?? ""}`}
      >
        <div className="flex items-center gap-2">
          <button
            className="flex-1 min-w-0 text-xs font-medium text-gray-800 truncate text-left"
            onClick={() => openTaskPanel(props.taskID)}
          >
            {props.title}
          </button>
          <input
            type="checkbox"
            checked={props.checked}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => props.onToggle(e.target.checked)}
            className="h-3.5 w-3.5 accent-indigo-600"
            title={props.checked ? "Mark not done" : "Mark done"}
          />
        </div>
      </div>
    );
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
          <button
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
            onClick={() => openAddTask()}
          >
            Add task
          </button>
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
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-start">
            <section className="xl:col-span-1 grid grid-rows-3 gap-3 h-[78vh]">
              <div className="bg-white rounded-xl border border-gray-200 p-3 min-h-0 overflow-hidden">
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
                  <ResponsiveContainer width="100%" height={170}>
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

              <div className="bg-white rounded-xl border border-gray-200 p-3 min-h-0 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <h2 className="font-semibold text-gray-900">
                      Week priorities
                    </h2>
                    <div className="relative group">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px] font-semibold text-gray-500 cursor-help">
                        i
                      </span>
                      <div className="pointer-events-none absolute left-1/2 top-5 z-20 hidden w-52 -translate-x-1/2 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[10px] text-gray-600 shadow-sm group-hover:block">
                        Create or drop tasks here. Drag to backlog to remove
                        from weekly focus.
                      </div>
                    </div>
                  </div>
                  <button
                    className="px-2.5 py-1 text-xs rounded-lg bg-indigo-600 text-white"
                    onClick={() => openAddTask(undefined, true)}
                  >
                    Add
                  </button>
                </div>

                <div
                  className="mt-2 space-y-1.5 flex-1 overflow-auto"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDropToWeekPriorities}
                >
                  {weekPriorityTasks.map((task) => (
                    <div key={task.id}>
                      {renderPlannerTaskCard({
                        taskID: task.id,
                        title: task.title,
                        checked: task.status === "done",
                        draggable: true,
                        onToggle: (checked) => {
                          void setTaskCompleted(task.id, checked);
                        },
                      })}
                    </div>
                  ))}
                  {weekPriorityTasks.length === 0 && (
                    <p className="text-[11px] text-indigo-600/80">
                      Drop tasks here to mark them as week priorities.
                    </p>
                  )}
                </div>
              </div>

              <div
                className="bg-white rounded-xl border border-gray-200 p-3 min-h-0 overflow-auto"
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
                <div className="mt-3 space-y-1.5">
                  {visibleBacklog.map((task) => (
                    <div key={task.id}>
                      {renderPlannerTaskCard({
                        taskID: task.id,
                        title: `(${taskROI(task).toFixed(2)}) ${task.title}`,
                        checked: task.status === "done",
                        draggable: true,
                        onToggle: (checked) => {
                          void setTaskCompleted(task.id, checked);
                        },
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="xl:col-span-4 bg-white rounded-xl border border-gray-200 p-3 h-[78vh] flex flex-col overflow-hidden">
              <div className="w-full h-full flex flex-col min-h-0">
                <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-gray-200 bg-white">
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

                <div
                  className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-gray-200 bg-gray-50/60"
                  style={{ height: `${dailyHeightPx}px` }}
                >
                  <div className="px-2 py-2 text-[10px] text-indigo-700 uppercase tracking-wide font-semibold">
                    Daily
                  </div>
                  {weekDays.map((day) => {
                    const daily = dailyByDay.get(day.index) ?? [];
                    return (
                      <div
                        key={day.index}
                        className="h-full overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-1.5 border-l border-gray-100 rounded-none"
                        style={HIDE_SCROLLBAR_STYLE}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => onDrop(e, day.index, "daily_priority")}
                      >
                        <div className="space-y-1">
                          {daily.map((item) => (
                            <div key={item.id}>
                              {renderPlannerTaskCard({
                                taskID: item.task_id,
                                title: item.task_title,
                                checked: item.task_status === "done",
                                draggable: true,
                                onToggle: (checked) => {
                                  void setTaskCompleted(item.task_id, checked);
                                },
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div
                  className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  style={HIDE_SCROLLBAR_STYLE}
                >
                  {currentWeekTimeLineTop != null && (
                    <div
                      className="absolute left-[56px] right-0 z-20 pointer-events-none"
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
                      className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-gray-100 min-h-[22px]"
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
                              <div key={item.id} className="mb-0.5">
                                {renderPlannerTaskCard({
                                  taskID: item.task_id,
                                  title: item.task_title,
                                  checked: item.task_status === "done",
                                  draggable: true,
                                  className: "p-1",
                                  onToggle: (checked) => {
                                    void setTaskCompleted(
                                      item.task_id,
                                      checked,
                                    );
                                  },
                                })}
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
                    <div>
                      <label className="text-xs text-gray-500">
                        Start time
                      </label>
                      <input
                        type="time"
                        step={900}
                        value={taskForm.start_time}
                        onChange={(e) =>
                          setTaskForm((prev) => ({
                            ...prev,
                            start_time: e.target.value,
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
                          void setTaskCompleted(selectedTaskID, true);
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

          {addTaskOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/20"
              onClick={() => setAddTaskOpen(false)}
            >
              <aside
                className="absolute right-0 top-0 h-full w-full max-w-md bg-white border-l border-gray-200 shadow-xl p-4 overflow-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      Add task
                    </h3>
                    <p className="text-xs text-gray-500">
                      {addTaskSlot
                        ? "Hour slot selected — this task is scheduled for 1 hour."
                        : "Create a new task directly from the planner."}
                    </p>
                  </div>
                  <button
                    className="text-gray-500"
                    onClick={() => setAddTaskOpen(false)}
                  >
                    ✕
                  </button>
                </div>

                {addTaskSlot && (
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800 mb-3">
                    <p>
                      {DAYS.find((day) => day.index === addTaskSlot.dayOfWeek)
                        ?.label ?? "Day"}{" "}
                      at {fmtTime(addTaskSlot.slotMinute)}
                    </p>
                    <p>Estimated time: 60 minutes</p>
                  </div>
                )}

                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-500">Title</label>
                    <input
                      value={addTaskForm.title}
                      onChange={(e) =>
                        setAddTaskForm((prev) => ({
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
                      value={addTaskForm.description}
                      onChange={(e) =>
                        setAddTaskForm((prev) => ({
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
                        value={addTaskForm.primary_role_id}
                        onChange={(e) =>
                          setAddTaskForm((prev) => ({
                            ...prev,
                            primary_role_id: e.target.value,
                            goal_id:
                              prev.goal_id &&
                              !(
                                groupedGoals
                                  .get(e.target.value)
                                  ?.some((goal) => goal.id === prev.goal_id) ??
                                false
                              )
                                ? ""
                                : prev.goal_id,
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
                        value={addTaskForm.goal_id}
                        onChange={(e) =>
                          setAddTaskForm((prev) => ({
                            ...prev,
                            goal_id: e.target.value,
                          }))
                        }
                        className="mt-1 w-full px-2 py-2 text-sm border border-gray-300 rounded-lg"
                      >
                        <option value="">No goal</option>
                        {(
                          groupedGoals.get(addTaskForm.primary_role_id) ?? []
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
                        value={addTaskForm.impact}
                        onChange={(e) =>
                          setAddTaskForm((prev) => ({
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
                        value={addTaskForm.effort}
                        onChange={(e) =>
                          setAddTaskForm((prev) => ({
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
                        value={
                          addTaskSlot ? "60" : addTaskForm.estimated_minutes
                        }
                        onChange={(e) =>
                          setAddTaskForm((prev) => ({
                            ...prev,
                            estimated_minutes: e.target.value,
                          }))
                        }
                        disabled={Boolean(addTaskSlot)}
                        className="mt-1 w-full px-2 py-2 text-sm border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={addTaskForm.is_week_priority}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setAddTaskForm((prev) => ({
                            ...prev,
                            is_week_priority: checked,
                            scheduled_date: checked ? "" : prev.scheduled_date,
                            start_time: checked ? "" : prev.start_time,
                          }));
                          if (checked) setAddTaskSlot(null);
                        }}
                      />
                      <span>Is Week Priority</span>
                      <span className="relative group inline-flex">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px] font-semibold text-gray-500 cursor-help">
                          i
                        </span>
                        <span className="pointer-events-none absolute left-1/2 top-5 z-20 hidden w-56 -translate-x-1/2 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[10px] text-gray-600 shadow-sm group-hover:block">
                          Use this for tasks you want to do this week but
                          haven’t assigned to a specific day yet.
                        </span>
                      </span>
                    </label>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">
                      Scheduled date
                    </label>
                    <input
                      type="date"
                      value={addTaskForm.scheduled_date}
                      onChange={(e) =>
                        setAddTaskForm((prev) => ({
                          ...prev,
                          scheduled_date: e.target.value,
                        }))
                      }
                      disabled={addTaskForm.is_week_priority}
                      className="mt-1 w-full px-2 py-2 text-sm border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">Start time</label>
                    <input
                      type="time"
                      step={900}
                      value={addTaskForm.start_time}
                      onChange={(e) =>
                        setAddTaskForm((prev) => ({
                          ...prev,
                          start_time: e.target.value,
                        }))
                      }
                      disabled={
                        Boolean(addTaskSlot) || addTaskForm.is_week_priority
                      }
                      className="mt-1 w-full px-2 py-2 text-sm border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500"
                    />
                    {!addTaskForm.is_week_priority && (
                      <p className="mt-1 text-[11px] text-gray-500">
                        If set (with a date inside this week), the task is added
                        to that timeslot.
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 text-white disabled:opacity-60"
                      onClick={createTaskFromPlanner}
                      disabled={
                        addTaskSaving ||
                        !addTaskForm.title.trim() ||
                        !addTaskForm.primary_role_id
                      }
                    >
                      {addTaskSaving ? "Creating..." : "Create task"}
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
