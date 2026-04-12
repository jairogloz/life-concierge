import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useApi } from "@/lib/useApi";

type ViewMode = "month" | "week" | "day";

type TaskItem = {
  id: string;
  title: string;
  task_type?: "one_time" | "daily";
  scheduled_date?: string | null;
  deadline?: string | null;
  soft_deadline?: string | null;
};

function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function monthGridStart(date: Date): Date {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  return startOfWeek(first);
}

function monthGridEnd(date: Date): Date {
  return addDays(monthGridStart(date), 41);
}

function taskYmd(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return ymd(parsed);
}

export default function CalendarScreen() {
  const api = useApi();
  const [view, setView] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scheduled, setScheduled] = useState<TaskItem[]>([]);
  const [unscheduled, setUnscheduled] = useState<TaskItem[]>([]);
  const [selected, setSelected] = useState<TaskItem | null>(null);
  const [selectedDate, setSelectedDate] = useState(ymd(new Date()));

  const range = useMemo(() => {
    if (view === "day") {
      const day = ymd(anchor);
      return { from: day, to: day };
    }
    if (view === "week") {
      const from = startOfWeek(anchor);
      return { from: ymd(from), to: ymd(addDays(from, 6)) };
    }
    return { from: ymd(monthGridStart(anchor)), to: ymd(monthGridEnd(anchor)) };
  }, [anchor, view]);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [scheduledRes, allTodoRes] = await Promise.all([
          api.get<{ data: TaskItem[] }>(
            `/tasks?status=todo&scheduled_from=${range.from}&scheduled_to=${range.to}`,
          ),
          api.get<{ data: TaskItem[] }>("/tasks?status=todo"),
        ]);
        setScheduled(scheduledRes.data.data ?? []);
        setUnscheduled((allTodoRes.data.data ?? []).filter((task) => !task.scheduled_date));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [api, range.from, range.to],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function saveSchedule() {
    if (!selected) return;
    await api.put(`/tasks/${selected.id}`, {
      scheduled_date: `${selectedDate}T00:00:00.000Z`,
    });
    setSelected(null);
    await load(true);
  }

  const dateBuckets = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    for (const task of scheduled) {
      const key = taskYmd(task.scheduled_date);
      if (!key) continue;
      const bucket = map.get(key) ?? [];
      bucket.push(task);
      map.set(key, bucket);
    }
    return map;
  }, [scheduled]);

  const weekDays = useMemo(() => {
    const first = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(first, i));
  }, [anchor]);

  const currentDayTasks = dateBuckets.get(ymd(anchor)) ?? [];

  function renderTask(task: TaskItem) {
    const dueClass = task.deadline
      ? styles.hardDue
      : task.soft_deadline
        ? styles.softDue
        : undefined;

    return (
      <TouchableOpacity key={task.id} style={styles.card} onPress={() => setSelected(task)}>
        <Text style={styles.title} numberOfLines={1}>
          {task.title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.type}>{task.task_type === "daily" ? "daily" : "one-time"}</Text>
          {dueClass && <Text style={dueClass}>{task.deadline ? "hard deadline" : "soft deadline"}</Text>}
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <View style={styles.modeRow}>
          {(["month", "week", "day"] as ViewMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              onPress={() => setView(mode)}
              style={[styles.modeBtn, view === mode && styles.modeBtnActive]}
            >
              <Text style={[styles.modeText, view === mode && styles.modeTextActive]}>{mode}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.navRow}>
          <TouchableOpacity onPress={() => setAnchor(addDays(anchor, view === "month" ? -30 : view === "week" ? -7 : -1))}>
            <Ionicons name="chevron-back" size={20} color="#4b5563" />
          </TouchableOpacity>
          <Text style={styles.rangeLabel}>{range.from === range.to ? range.from : `${range.from} → ${range.to}`}</Text>
          <TouchableOpacity onPress={() => setAnchor(addDays(anchor, view === "month" ? 30 : view === "week" ? 7 : 1))}>
            <Ionicons name="chevron-forward" size={20} color="#4b5563" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={
          view === "day"
            ? currentDayTasks
            : view === "week"
              ? weekDays.flatMap((d) => [
                  { id: `h-${ymd(d)}`, title: ymd(d), task_type: "one_time" as const },
                  ...(dateBuckets.get(ymd(d)) ?? []),
                ])
              : Array.from({ length: 42 }, (_, i) => addDays(monthGridStart(anchor), i)).map((d) => ({
                  id: `m-${ymd(d)}`,
                  title: `${ymd(d)} · ${(dateBuckets.get(ymd(d)) ?? []).length} tasks`,
                  task_type: "one_time" as const,
                }))
        }
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            tintColor="#4f46e5"
          />
        }
        renderItem={({ item }) => {
          if (item.id.startsWith("h-") || item.id.startsWith("m-")) {
            return <Text style={styles.sectionTitle}>{item.title}</Text>;
          }
          return renderTask(item);
        }}
        ListHeaderComponent={
          <View style={styles.unscheduledBox}>
            <Text style={styles.unscheduledTitle}>Unscheduled tasks ({unscheduled.length})</Text>
            <View style={styles.unscheduledWrap}>
              {unscheduled.slice(0, 8).map((task) => (
                <TouchableOpacity
                  key={task.id}
                  style={styles.unscheduledChip}
                  onPress={() => setSelected(task)}
                >
                  <Text style={styles.unscheduledChipText} numberOfLines={1}>{task.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
      />

      <Modal visible={Boolean(selected)} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reschedule task</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalTask} numberOfLines={2}>{selected?.title}</Text>
            <Text style={styles.modalHint}>Pick date (YYYY-MM-DD)</Text>
            <TextInput
              value={selectedDate}
              onChangeText={setSelectedDate}
              autoCapitalize="none"
              style={styles.input}
              placeholder="2026-04-15"
            />
            <View style={styles.quickRow}>
              <TouchableOpacity onPress={() => setSelectedDate(ymd(new Date()))} style={styles.quickBtn}><Text style={styles.quickBtnText}>Today</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setSelectedDate(ymd(addDays(new Date(), 1)))} style={styles.quickBtn}><Text style={styles.quickBtnText}>Tomorrow</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setSelectedDate(ymd(addDays(new Date(), 7)))} style={styles.quickBtn}><Text style={styles.quickBtnText}>+7 days</Text></TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={saveSchedule}>
              <Text style={styles.saveBtnText}>Save date</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  modeRow: { flexDirection: "row", gap: 8 },
  modeBtn: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  modeBtnActive: { borderColor: "#c7d2fe", backgroundColor: "#eef2ff" },
  modeText: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  modeTextActive: { color: "#4f46e5" },
  navRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rangeLabel: { fontSize: 12, color: "#4b5563", fontWeight: "600" },
  list: { padding: 16, gap: 8 },
  sectionTitle: { fontSize: 12, color: "#6b7280", fontWeight: "700", marginTop: 8 },
  card: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 10,
    gap: 6,
  },
  title: { fontSize: 13, color: "#111827", fontWeight: "600" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  type: { fontSize: 11, color: "#4f46e5", fontWeight: "600" },
  hardDue: {
    fontSize: 10,
    color: "#b91c1c",
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  softDue: {
    fontSize: 10,
    color: "#92400e",
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  unscheduledBox: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 10,
  },
  unscheduledTitle: { fontSize: 12, color: "#6b7280", fontWeight: "700", marginBottom: 8 },
  unscheduledWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  unscheduledChip: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: "48%",
  },
  unscheduledChipText: { fontSize: 11, color: "#4b5563" },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.25)" },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    gap: 10,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontSize: 16, color: "#111827", fontWeight: "700" },
  modalTask: { fontSize: 13, color: "#374151" },
  modalHint: { fontSize: 11, color: "#6b7280" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: "#111827",
  },
  quickRow: { flexDirection: "row", gap: 8 },
  quickBtn: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 999,
    backgroundColor: "#f9fafb",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quickBtnText: { fontSize: 11, color: "#4b5563", fontWeight: "600" },
  saveBtn: {
    backgroundColor: "#4f46e5",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 10,
  },
  saveBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
