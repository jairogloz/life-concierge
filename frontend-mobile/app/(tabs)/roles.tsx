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
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApi } from '@/lib/useApi';
import type { Role } from '@/types';

const WEIGHT_MAX = 10;

function WeightBar({ weight }: { weight: number }) {
  const pct = Math.min((weight / WEIGHT_MAX) * 100, 100);
  return (
    <View style={styles.weightTrack}>
      <View style={[styles.weightFill, { width: `${pct}%` }]} />
    </View>
  );
}

type RoleFormData = { name: string; description: string; weight: string };

function RoleModal({
  visible,
  initial,
  onClose,
  onSave,
}: {
  visible: boolean;
  initial: Partial<Role> | null;
  onClose: () => void;
  onSave: (data: RoleFormData) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [weight, setWeight] = useState('5');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(initial?.name ?? '');
      setDescription(initial?.description ?? '');
      setWeight(String(initial?.weight ?? 5));
    }
  }, [visible, initial]);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Validation', 'Name is required.');
      return;
    }
    const w = parseFloat(weight);
    if (isNaN(w) || w < 0 || w > 10) {
      Alert.alert('Validation', 'Weight must be 0–10.');
      return;
    }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), description: description.trim(), weight });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{initial?.id ? 'Edit Role' : 'New Role'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Parent, Professional"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Optional description"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
            />

            <Text style={styles.label}>Weight (0–10)</Text>
            <TextInput
              style={styles.input}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              placeholder="5"
              placeholderTextColor="#9ca3af"
            />

            <TouchableOpacity
              style={[styles.btn, saving && styles.btnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>{initial?.id ? 'Save Changes' : 'Create Role'}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function RolesScreen() {
  const api = useApi();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<Partial<Role> | null>(null);

  const fetchRoles = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await api.get<{ data: Role[] }>('/roles');
        setRoles(res.data.data ?? []);
      } catch {
        Alert.alert('Error', 'Failed to load roles.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [api]
  );

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  function openCreate() {
    setEditTarget(null);
    setModalVisible(true);
  }

  function openEdit(role: Role) {
    setEditTarget(role);
    setModalVisible(true);
  }

  async function handleSave(data: RoleFormData) {
    const payload = {
      name: data.name,
      description: data.description,
      weight: parseFloat(data.weight),
    };
    try {
      if (editTarget?.id) {
        await api.put(`/roles/${editTarget.id}`, payload);
      } else {
        await api.post('/roles', payload);
      }
      setModalVisible(false);
      fetchRoles(true);
    } catch {
      Alert.alert('Error', 'Could not save role.');
    }
  }

  async function handleDelete(role: Role) {
    Alert.alert('Delete Role', `Delete "${role.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/roles/${role.id}`);
            setRoles((prev) => prev.filter((r) => r.id !== role.id));
          } catch {
            Alert.alert('Error', 'Could not delete role.');
          }
        },
      },
    ]);
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
      <FlatList
        data={roles}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardContent}>
              <Text style={styles.roleName}>{item.name}</Text>
              {item.description ? (
                <Text style={styles.roleDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
              <View style={styles.weightRow}>
                <WeightBar weight={item.weight} />
                <Text style={styles.weightLabel}>{item.weight}</Text>
              </View>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => openEdit(item)} style={styles.iconBtn}>
                <Ionicons name="pencil-outline" size={18} color="#4f46e5" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconBtn}>
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchRoles(true);
            }}
            tintColor="#4f46e5"
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={56} color="#d1d5db" />
            <Text style={styles.emptyText}>No roles yet</Text>
            <Text style={styles.emptySubtext}>Tap + to add your first life role.</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={openCreate} accessibilityLabel="Add role">
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <RoleModal
        visible={modalVisible}
        initial={editTarget}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardContent: { flex: 1 },
  roleName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  roleDesc: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  weightRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  weightTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  weightFill: { height: '100%', backgroundColor: '#4f46e5', borderRadius: 3 },
  weightLabel: { fontSize: 12, color: '#6b7280', width: 24, textAlign: 'right' },
  cardActions: { flexDirection: 'row', gap: 4, marginLeft: 8 },
  iconBtn: { padding: 6 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#374151' },
  emptySubtext: { fontSize: 13, color: '#9ca3af' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  label: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#f9fafb',
    marginBottom: 14,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  btn: {
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
