import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useApi } from "@/lib/useApi";
import type { TimelineEvent, TimelineEventType } from "@/types";

// ── Event config ──────────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<TimelineEventType, { icon: string; label: string; bg: string; color: string }> = {
  task_completed:     { icon: "✅", label: "Task completed",     bg: "#dcfce7", color: "#15803d" },
  expense_logged:     { icon: "💰", label: "Expense logged",     bg: "#dbeafe", color: "#1d4ed8" },
  wishlist_evaluated: { icon: "🛒", label: "Wishlist evaluated", bg: "#f3e8ff", color: "#7e22ce" },
  role_updated:       { icon: "🎭", label: "Role updated",       bg: "#f3f4f6", color: "#374151" },
  goal_updated:       { icon: "🏆", label: "Goal updated",       bg: "#fef9c3", color: "#92400e" },
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function payloadSummary(event: TimelineEvent): string | null {
  const p = event.payload as Record<string, unknown>;
  if (!p || Object.keys(p).length === 0) return null;
  const parts: string[] = [];
  if (typeof p.title === "string")   parts.push(p.title);
  if (typeof p.amount === "number")  parts.push(`$${p.amount}`);
  if (typeof p.verdict === "string") parts.push(`verdict: ${p.verdict}`);
  return parts.length ? parts.join(" · ") : null;
}

// ── Screen ─────────────────────────────────────────────────────────────────

const LIMIT = 20;

export default function TimelineScreen() {
  const api = useApi();
  const [events, setEvents]     = useState<TimelineEvent[]>([]);
  const [total, setTotal]       = useState(0);
  const [offset, setOffset]     = useState(0);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadData = useCallback(async (off: number, refresh = false) => {
    if (refresh) setRefreshing(true);
    else if (off === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await api.get(`/timeline?limit=${LIMIT}&offset=${off}`);
      const data = (res.data as { data: TimelineEvent[]; total: number });
      setEvents(off === 0 ? (data.data ?? []) : prev => [...prev, ...(data.data ?? [])]);
      setTotal(data.total ?? 0);
      setOffset(off);
    } catch {
      // silently fail on timeline load errors
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [api]);

  useEffect(() => { loadData(0); }, [loadData]);

  function onRefresh() { loadData(0, true); }
  function loadMore() { if (!loadingMore && offset + LIMIT < total) loadData(offset + LIMIT); }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <Text style={styles.count}>{total} event{total !== 1 ? "s" : ""} recorded</Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>No events yet</Text>
            <Text style={styles.emptySubtitle}>Events appear here automatically as you use the app.</Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color="#4f46e5" style={{ marginVertical: 16 }} /> : null
        }
        renderItem={({ item }) => {
          const cfg = EVENT_CONFIG[item.event_type] ?? { icon: "📌", label: item.event_type, bg: "#f3f4f6", color: "#374151" };
          const summary = payloadSummary(item);
          return (
            <View style={styles.eventRow}>
              {/* Timeline line + dot */}
              <View style={styles.dotColumn}>
                <View style={[styles.dot, { backgroundColor: cfg.bg, borderColor: cfg.color }]}>
                  <Text style={styles.dotIcon}>{cfg.icon}</Text>
                </View>
                <View style={styles.line} />
              </View>
              {/* Card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.eventLabel, { color: cfg.color }]}>{cfg.label}</Text>
                  <Text style={styles.time}>{relativeTime(item.occurred_at)}</Text>
                </View>
                <View style={[styles.domainPill, { backgroundColor: cfg.bg }]}>
                  <Text style={[styles.domainText, { color: cfg.color }]}>{item.domain}</Text>
                </View>
                {summary ? <Text style={styles.summary}>{summary}</Text> : null}
              </View>
            </View>
          );
        }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center:    { flex: 1, alignItems: "center", justifyContent: "center" },
  count:     { fontSize: 12, color: "#9ca3af", marginBottom: 12 },

  emptyContainer: { alignItems: "center", paddingTop: 40 },
  emptyIcon:      { fontSize: 40, marginBottom: 12 },
  emptyTitle:     { fontSize: 16, fontWeight: "600", color: "#374151" },
  emptySubtitle:  { fontSize: 13, color: "#9ca3af", marginTop: 4, textAlign: "center" },

  eventRow:   { flexDirection: "row", marginBottom: 16, minHeight: 60 },
  dotColumn:  { width: 44, alignItems: "center" },
  dot: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center", zIndex: 1,
  },
  dotIcon:  { fontSize: 16 },
  line:     { flex: 1, width: 2, backgroundColor: "#e5e7eb", marginTop: 4 },

  card: {
    flex: 1, marginLeft: 10, backgroundColor: "#fff",
    borderRadius: 12, padding: 12,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" },
  eventLabel:  { fontSize: 13, fontWeight: "700" },
  time:        { fontSize: 11, color: "#9ca3af" },
  domainPill:  { alignSelf: "flex-start", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  domainText:  { fontSize: 11, fontWeight: "600" },
  summary:     { fontSize: 12, color: "#6b7280", marginTop: 4 },
});
