import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useApi } from "@/lib/useApi";
import type { GamificationProfile, Role, ScoredTask } from "@/types";

type TaskType = "one_time" | "daily";

type TaskLike = ScoredTask["task"] & {
  task_type?: TaskType;
  completion_log?: { date: string; done: boolean }[];
  scheduled_date?: string | null;
};

const TASK_TYPE_COLOURS: Record<TaskType, string> = {
  one_time: "#6366f1",
  daily: "#10b981",
};

function getTaskType(task: TaskLike): TaskType {
  return task.task_type === "daily" ? "daily" : "one_time";
}

function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function taskScheduledYMD(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return ymd(parsed);
}

function isDailyDoneToday(task: TaskLike): boolean {
  if (getTaskType(task) !== "daily") return false;
  const today = ymd(new Date());
  return (task.completion_log ?? []).some(
    (entry) => entry.date === today && entry.done,
  );
}

function TaskCard({
  item,
  onComplete,
}: {
  item: ScoredTask;
  onComplete: (id: string) => void;
}) {
  const { score } = item;
  const task = item.task as TaskLike;
  const taskType = getTaskType(task);
  const colour = TASK_TYPE_COLOURS[taskType] ?? "#6b7280";

  return (
    <View style={styles.card}>
      <View style={[styles.stripe, { backgroundColor: colour }]} />
      <View style={styles.cardBody}>
        <Text style={styles.taskTitle} numberOfLines={2}>
          {task.title}
        </Text>
        <View style={styles.meta}>
          <View style={[styles.badge, { backgroundColor: colour + "20" }]}>
            <Text style={[styles.badgeText, { color: colour }]}>
              {taskType === "daily" ? "daily" : "one-time"}
            </Text>
          </View>
          <Text style={styles.score}>⚡ {score.toFixed(1)}</Text>
        </View>
        {taskType === "daily" && (
          <Text
            style={isDailyDoneToday(task) ? styles.dailyDone : styles.dailyTodo}
          >
            {isDailyDoneToday(task) ? "● done today" : "○ not done today"}
          </Text>
        )}
        {task.context_tags?.length > 0 && (
          <Text style={styles.tags}>
            {task.context_tags.map((t) => `#${t}`).join(" ")}
          </Text>
        )}
      </View>
      <TouchableOpacity
        style={styles.completeBtn}
        onPress={() => onComplete(task.id)}
        accessibilityLabel={`Complete ${task.title}`}
      >
        <Ionicons name="checkmark-circle-outline" size={28} color="#10b981" />
      </TouchableOpacity>
    </View>
  );
}

export default function TodayScreen() {
  const api = useApi();
  const [tasks, setTasks] = useState<ScoredTask[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [gamification, setGamification] = useState<GamificationProfile | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "role" | "tag">("all");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const fetchRanked = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [rankedRes, rolesRes, tagsRes, gmRes] = await Promise.all([
          api.get<{ data: ScoredTask[] }>("/tasks/ranked?limit=50"),
          api.get<{ data: Role[] }>("/roles"),
          api.get<{ data: string[] }>("/tasks/tags"),
          api
            .get<{ data: GamificationProfile }>("/gamification/profile")
            .catch(() => null),
        ]);
        setTasks(rankedRes.data.data ?? []);
        setRoles(rolesRes.data.data ?? []);
        setTags(tagsRes.data.data ?? []);
        setGamification(gmRes?.data?.data ?? null);
      } catch (err) {
        console.error("Failed to fetch ranked tasks", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [api],
  );

  useEffect(() => {
    fetchRanked();
  }, [fetchRanked]);

  async function handleComplete(id: string) {
    try {
      await api.patch(`/tasks/${id}/complete`);
      setTasks((prev) => prev.filter((st) => st.task.id !== id));
      const gmRes = await api
        .get<{ data: GamificationProfile }>("/gamification/profile")
        .catch(() => null);
      setGamification(gmRes?.data?.data ?? null);
    } catch {
      Alert.alert("Error", "Could not complete task.");
    }
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag],
    );
  }

  const filteredTasks = tasks.filter((row) => {
    const task = row.task as TaskLike;
    if (filterMode === "role" && selectedRoleId) {
      return task.primary_role_id === selectedRoleId;
    }
    if (filterMode === "tag" && selectedTags.length > 0) {
      const taskTags = task.context_tags ?? [];
      return selectedTags.some((tag) => taskTags.includes(tag));
    }
    return true;
  });

  const today = ymd(new Date());
  const scheduledToday = filteredTasks.filter(
    (row) => taskScheduledYMD((row.task as TaskLike).scheduled_date) === today,
  );
  const backlog = filteredTasks.filter(
    (row) => taskScheduledYMD((row.task as TaskLike).scheduled_date) !== today,
  );

  const sectionedData: Array<
    | { type: "header"; id: string; title: string }
    | { type: "task"; id: string; item: ScoredTask }
  > = [
    {
      type: "header",
      id: "h-scheduled",
      title: `Scheduled for today (${scheduledToday.length})`,
    },
    ...scheduledToday.map((item) => ({
      type: "task" as const,
      id: `s-${item.task.id}`,
      item,
    })),
    {
      type: "header",
      id: "h-backlog",
      title: `Anytime / backlog (${backlog.length})`,
    },
    ...backlog.map((item) => ({
      type: "task" as const,
      id: `b-${item.task.id}`,
      item,
    })),
  ];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => setFilterOpen(true)}
        >
          <Ionicons name="options-outline" size={16} color="#4f46e5" />
          <Text style={styles.filterBtnText}>Filters</Text>
        </TouchableOpacity>

        {gamification && (
          <View style={styles.gamificationCard}>
            <Text style={styles.gamificationTitle}>🏆 Momentum</Text>
            <View style={styles.gamificationMetaRow}>
              <Text style={styles.gamificationChip}>
                {gamification.total_xp} XP
              </Text>
              <Text style={styles.gamificationChip}>
                🔥 {gamification.global_current_streak} day streak
              </Text>
            </View>
            {gamification.recent_achievements.length > 0 && (
              <Text style={styles.gamificationAchievement}>
                Latest: {gamification.recent_achievements[0].title}
              </Text>
            )}
          </View>
        )}
      </View>

      <FlatList
        data={sectionedData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          if (item.type === "header") {
            return <Text style={styles.sectionTitle}>{item.title}</Text>;
          }
          return <TaskCard item={item.item} onComplete={handleComplete} />;
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchRanked(true);
            }}
            tintColor="#4f46e5"
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name="checkmark-done-circle-outline"
              size={56}
              color="#d1d5db"
            />
            <Text style={styles.emptyText}>No tasks match this filter.</Text>
            <Text style={styles.emptySubtext}>
              Pull to refresh or change filters.
            </Text>
          </View>
        }
      />

      <Modal
        visible={filterOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterOpen(false)}
      >
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Task filters</Text>
              <TouchableOpacity onPress={() => setFilterOpen(false)}>
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modeRow}>
              {[
                { id: "all", label: "All tasks" },
                { id: "role", label: "Per role" },
                { id: "tag", label: "Per tag" },
              ].map((mode) => (
                <TouchableOpacity
                  key={mode.id}
                  style={[
                    styles.modeBtn,
                    filterMode === mode.id && styles.modeBtnActive,
                  ]}
                  onPress={() =>
                    setFilterMode(mode.id as "all" | "role" | "tag")
                  }
                >
                  <Text
                    style={[
                      styles.modeBtnText,
                      filterMode === mode.id && styles.modeBtnTextActive,
                    ]}
                  >
                    {mode.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {filterMode === "role" && (
              <ScrollView style={styles.sheetScroll}>
                <TouchableOpacity
                  style={[
                    styles.optionRow,
                    selectedRoleId === "" && styles.optionRowActive,
                  ]}
                  onPress={() => setSelectedRoleId("")}
                >
                  <Text style={styles.optionText}>All roles</Text>
                </TouchableOpacity>
                {roles.map((role) => (
                  <TouchableOpacity
                    key={role.id}
                    style={[
                      styles.optionRow,
                      selectedRoleId === role.id && styles.optionRowActive,
                    ]}
                    onPress={() => setSelectedRoleId(role.id)}
                  >
                    <Text style={styles.optionText}>{role.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {filterMode === "tag" && (
              <View style={styles.tagWrap}>
                {tags.length === 0 ? (
                  <Text style={styles.emptyTags}>No tags yet.</Text>
                ) : (
                  tags.map((tag) => {
                    const active = selectedTags.includes(tag);
                    return (
                      <TouchableOpacity
                        key={tag}
                        style={[styles.tagChip, active && styles.tagChipActive]}
                        onPress={() => toggleTag(tag)}
                      >
                        <Text
                          style={[
                            styles.tagChipText,
                            active && styles.tagChipTextActive,
                          ]}
                        >
                          #{tag}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            )}

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => setFilterOpen(false)}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16, gap: 12 },
  filterBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#c7d2fe",
    backgroundColor: "#eef2ff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterBtnText: { color: "#4f46e5", fontSize: 12, fontWeight: "600" },
  gamificationCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  gamificationTitle: { fontSize: 12, color: "#92400e", fontWeight: "700" },
  gamificationMetaRow: {
    marginTop: 6,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  gamificationChip: {
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 11,
    color: "#92400e",
    fontWeight: "600",
  },
  gamificationAchievement: {
    marginTop: 6,
    fontSize: 11,
    color: "#a16207",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4b5563",
    marginTop: 4,
    marginBottom: 2,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  stripe: { width: 5, alignSelf: "stretch" },
  cardBody: { flex: 1, padding: 14 },
  taskTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 6,
  },
  meta: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  score: { fontSize: 12, color: "#6b7280" },
  dailyDone: { fontSize: 11, color: "#047857", marginTop: 4 },
  dailyTodo: { fontSize: 11, color: "#6b7280", marginTop: 4 },
  tags: { fontSize: 11, color: "#9ca3af", marginTop: 4 },
  completeBtn: { padding: 14 },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 18, fontWeight: "600", color: "#374151" },
  emptySubtext: { fontSize: 13, color: "#9ca3af", textAlign: "center" },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    gap: 12,
    maxHeight: "75%",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  modeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  modeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  modeBtnActive: {
    borderColor: "#c7d2fe",
    backgroundColor: "#eef2ff",
  },
  modeBtnText: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  modeBtnTextActive: { color: "#4f46e5" },
  sheetScroll: { maxHeight: 280 },
  optionRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  optionRowActive: {
    borderColor: "#c7d2fe",
    backgroundColor: "#eef2ff",
  },
  optionText: { color: "#374151", fontSize: 13, fontWeight: "500" },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  tagChipActive: {
    borderColor: "#d8b4fe",
    backgroundColor: "#faf5ff",
  },
  tagChipText: { color: "#6b7280", fontSize: 12, fontWeight: "600" },
  tagChipTextActive: { color: "#7e22ce" },
  emptyTags: { color: "#9ca3af", fontSize: 12 },
  doneBtn: {
    marginTop: 4,
    backgroundColor: "#4f46e5",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  doneBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
