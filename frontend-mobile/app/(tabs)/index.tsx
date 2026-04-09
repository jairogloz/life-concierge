import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApi } from '@/lib/useApi';
import type { ScoredTask } from '@/types';

const COMMITMENT_COLOURS: Record<string, string> = {
  commitment: '#ef4444',
  habit: '#3b82f6',
  recurring: '#8b5cf6',
  intention: '#10b981',
};

function TaskCard({
  item,
  onComplete,
}: {
  item: ScoredTask;
  onComplete: (id: string) => void;
}) {
  const { task, score } = item;
  const colour = COMMITMENT_COLOURS[task.commitment_type] ?? '#6b7280';

  return (
    <View style={styles.card}>
      <View style={[styles.stripe, { backgroundColor: colour }]} />
      <View style={styles.cardBody}>
        <Text style={styles.taskTitle} numberOfLines={2}>
          {task.title}
        </Text>
        <View style={styles.meta}>
          <View style={[styles.badge, { backgroundColor: colour + '20' }]}>
            <Text style={[styles.badgeText, { color: colour }]}>
              {task.commitment_type}
            </Text>
          </View>
          <Text style={styles.score}>⚡ {score.toFixed(1)}</Text>
        </View>
        {task.context_tags?.length > 0 && (
          <Text style={styles.tags}>{task.context_tags.map((t) => `#${t}`).join(' ')}</Text>
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRanked = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await api.get<ScoredTask[]>('/tasks/ranked?limit=20');
        setTasks(res.data ?? []);
      } catch (err) {
        console.error('Failed to fetch ranked tasks', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [api]
  );

  useEffect(() => {
    fetchRanked();
  }, [fetchRanked]);

  async function handleComplete(id: string) {
    try {
      await api.patch(`/tasks/${id}/complete`);
      setTasks((prev) => prev.filter((st) => st.task.id !== id));
    } catch {
      Alert.alert('Error', 'Could not complete task.');
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <FlatList
      data={tasks}
      keyExtractor={(item) => item.task.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <TaskCard item={item} onComplete={handleComplete} />
      )}
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
          <Ionicons name="checkmark-done-circle-outline" size={56} color="#d1d5db" />
          <Text style={styles.emptyText}>All caught up!</Text>
          <Text style={styles.emptySubtext}>Pull to refresh or add new tasks via Capture.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  stripe: { width: 5, alignSelf: 'stretch' },
  cardBody: { flex: 1, padding: 14 },
  taskTitle: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  score: { fontSize: 12, color: '#6b7280' },
  tags: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
  completeBtn: { padding: 14 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#374151' },
  emptySubtext: { fontSize: 13, color: '#9ca3af', textAlign: 'center' },
});
