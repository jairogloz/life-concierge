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
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useApi } from "@/lib/useApi";
import type { WishlistItem, WishlistVerdict } from "@/types";

// ── Verdict config ────────────────────────────────────────────────────────────

const VERDICT: Record<WishlistVerdict, { label: string; color: string; bg: string }> = {
  buy_now: { label: "Buy Now",  color: "#16a34a", bg: "#dcfce7" },
  wait:    { label: "Wait",     color: "#b45309", bg: "#fef9c3" },
  reject:  { label: "Reject",   color: "#dc2626", bg: "#fee2e2" },
  replace: { label: "Replace",  color: "#1d4ed8", bg: "#dbeafe" },
};

const fmt = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

// ── Add Item Modal ────────────────────────────────────────────────────────────

function AddItemModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    price: string;
    currency: string;
    importance: string;
    cooldown_days: string;
  }) => Promise<void>;
}) {
  const [title, setTitle]           = useState("");
  const [price, setPrice]           = useState("");
  const [currency, setCurrency]     = useState("USD");
  const [importance, setImportance] = useState("5");
  const [cooldown, setCooldown]     = useState("30");
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle(""); setPrice(""); setCurrency("USD");
      setImportance("5"); setCooldown("30");
    }
  }, [visible]);

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert("Validation", "Title is required.");
      return;
    }
    setSaving(true);
    try {
      await onSave({ title: title.trim(), price, currency, importance, cooldown_days: cooldown });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Wishlist Item</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input} value={title} onChangeText={setTitle}
              placeholder="e.g. Noise-cancelling headphones"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.label}>Price</Text>
            <TextInput
              style={styles.input} value={price} onChangeText={setPrice}
              placeholder="0.00" placeholderTextColor="#9ca3af"
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Currency</Text>
            <TextInput
              style={styles.input} value={currency} onChangeText={setCurrency}
              placeholder="USD" placeholderTextColor="#9ca3af"
              autoCapitalize="characters" maxLength={3}
            />

            <Text style={styles.label}>Importance (1-10)</Text>
            <TextInput
              style={styles.input} value={importance} onChangeText={setImportance}
              placeholder="5" placeholderTextColor="#9ca3af" keyboardType="number-pad"
            />

            <Text style={styles.label}>Cooldown (days)</Text>
            <TextInput
              style={styles.input} value={cooldown} onChangeText={setCooldown}
              placeholder="30" placeholderTextColor="#9ca3af" keyboardType="number-pad"
            />
          </ScrollView>

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave} disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Add to Wishlist</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function WishlistScreen() {
  const api = useApi();
  const [items, setItems]       = useState<WishlistItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd]   = useState(false);
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await api.get("/wishlist");
      setItems((res.data as { data: WishlistItem[] }).data ?? []);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.error?.message ?? "Failed to load wishlist.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => { loadData(); }, [loadData]);

  function onRefresh() { setRefreshing(true); loadData(); }

  async function handleCreate(data: {
    title: string; price: string; currency: string;
    importance: string; cooldown_days: string;
  }) {
    try {
      await api.post("/wishlist", {
        title:        data.title,
        price:        parseFloat(data.price) || 0,
        currency:     data.currency || "USD",
        importance:   parseInt(data.importance) || 5,
        cooldown_days: parseInt(data.cooldown_days) || 30,
      });
      setShowAdd(false);
      loadData();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.error?.message ?? "Failed to add item.");
      throw e;
    }
  }

  async function handleEvaluate(itemId: string) {
    setEvaluatingId(itemId);
    try {
      const res = await api.post(`/wishlist/${itemId}/evaluate`, {});
      setItems(prev => prev.map(i => i.id === itemId ? (res.data as WishlistItem) : i));
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.error?.message ?? "Evaluation failed.");
    } finally {
      setEvaluatingId(null);
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
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No items yet. Tap + to add one.</Text>
        }
        renderItem={({ item }) => {
          const vc = item.verdict ? VERDICT[item.verdict] : null;
          const isEval = evaluatingId === item.id;
          return (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardPrice}>{fmt(item.price, item.currency)}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>Importance: {item.importance}/10</Text>
                    {item.roi_score != null && (
                      <Text style={styles.metaText}>  ROI: {item.roi_score}/10</Text>
                    )}
                  </View>
                </View>
                <View style={styles.cardActions}>
                  {vc && (
                    <View style={[styles.verdictBadge, { backgroundColor: vc.bg }]}>
                      <Text style={[styles.verdictText, { color: vc.color }]}>{vc.label}</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={[styles.evalBtn, isEval && { opacity: 0.5 }]}
                    onPress={() => handleEvaluate(item.id)}
                    disabled={isEval}
                  >
                    {isEval
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.evalBtnText}>🤖 Ask AI</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
              {item.verdict_reasoning ? (
                <Text style={styles.reasoning}>"{item.verdict_reasoning}"</Text>
              ) : null}
            </View>
          );
        }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setShowAdd(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <AddItemModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={handleCreate}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center:    { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { textAlign: "center", color: "#9ca3af", fontSize: 14, marginTop: 40 },

  card: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 12,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardRow:    { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardInfo:   { flex: 1 },
  cardTitle:  { fontSize: 15, fontWeight: "700", color: "#111827" },
  cardPrice:  { fontSize: 18, fontWeight: "700", color: "#4f46e5", marginTop: 2 },
  metaRow:    { flexDirection: "row", flexWrap: "wrap", marginTop: 4, gap: 6 },
  metaText:   { fontSize: 11, color: "#6b7280" },
  cardActions:{ alignItems: "flex-end", gap: 8 },

  verdictBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  verdictText:  { fontSize: 12, fontWeight: "700" },

  evalBtn:     { backgroundColor: "#4f46e5", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  evalBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  reasoning: {
    marginTop: 10, fontSize: 13, color: "#6b7280", fontStyle: "italic",
    borderTopWidth: 1, borderTopColor: "#f3f4f6", paddingTop: 8,
  },

  fab: {
    position: "absolute", bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28, backgroundColor: "#4f46e5",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#4f46e5", shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard:    { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "85%" },
  modalHeader:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  modalTitle:   { fontSize: 18, fontWeight: "700", color: "#111827" },
  label:        { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: "#111827", backgroundColor: "#f9fafb",
  },
  saveBtn:     { backgroundColor: "#4f46e5", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 20 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
