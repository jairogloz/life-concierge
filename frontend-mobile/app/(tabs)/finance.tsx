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
import type {
  Account,
  Transaction,
  FinanceSummary,
  AccountType,
  TransactionType,
} from "@/types";

const ACCOUNT_TYPES: AccountType[] = [
  "checking",
  "savings",
  "cash",
  "investment",
  "credit_card",
  "other",
];
const TX_TYPES: TransactionType[] = ["income", "expense"];

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards({ summary }: { summary: FinanceSummary | null }) {
  if (!summary) return null;
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  return (
    <View style={styles.summaryRow}>
      <View style={[styles.summaryCard, { borderLeftColor: "#4f46e5" }]}>
        <Text style={styles.summaryLabel}>Total Balance</Text>
        <Text style={[styles.summaryValue, { color: "#4f46e5" }]}>
          {fmt(summary.total_balance)}
        </Text>
      </View>
      <View style={[styles.summaryCard, { borderLeftColor: "#16a34a" }]}>
        <Text style={styles.summaryLabel}>Month Income</Text>
        <Text style={[styles.summaryValue, { color: "#16a34a" }]}>
          {fmt(summary.month_income)}
        </Text>
      </View>
      <View style={[styles.summaryCard, { borderLeftColor: "#dc2626" }]}>
        <Text style={styles.summaryLabel}>Month Expenses</Text>
        <Text style={[styles.summaryValue, { color: "#dc2626" }]}>
          {fmt(summary.month_expenses)}
        </Text>
      </View>
    </View>
  );
}

// ─── Add Account Modal ────────────────────────────────────────────────────────

function AddAccountModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    account_type: AccountType;
    currency: string;
    opening_balance: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("checking");
  const [currency, setCurrency] = useState("USD");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName("");
      setAccountType("checking");
      setCurrency("USD");
      setOpeningBalance("0");
    }
  }, [visible]);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert("Validation", "Account name is required.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        account_type: accountType,
        currency: currency.trim() || "USD",
        opening_balance: openingBalance,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Account</Text>
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
              placeholder="e.g. Main Checking"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.label}>Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {ACCOUNT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.chip,
                      accountType === t && styles.chipActive,
                    ]}
                    onPress={() => setAccountType(t)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        accountType === t && styles.chipTextActive,
                      ]}
                    >
                      {t.replace("_", " ")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.label}>Currency</Text>
            <TextInput
              style={styles.input}
              value={currency}
              onChangeText={setCurrency}
              placeholder="USD"
              placeholderTextColor="#9ca3af"
              autoCapitalize="characters"
              maxLength={3}
            />

            <Text style={styles.label}>Opening Balance</Text>
            <TextInput
              style={styles.input}
              value={openingBalance}
              onChangeText={setOpeningBalance}
              placeholder="0.00"
              placeholderTextColor="#9ca3af"
              keyboardType="decimal-pad"
            />
          </ScrollView>

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Create Account</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Add Transaction Modal ────────────────────────────────────────────────────

function AddTransactionModal({
  visible,
  accounts,
  onClose,
  onSave,
}: {
  visible: boolean;
  accounts: Account[];
  onClose: () => void;
  onSave: (data: {
    account_id: string;
    type: TransactionType;
    amount: string;
    category: string;
    description: string;
    date: string;
  }) => Promise<void>;
}) {
  const [accountId, setAccountId] = useState("");
  const [txType, setTxType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setAccountId(accounts[0]?.id ?? "");
      setTxType("expense");
      setAmount("");
      setCategory("");
      setDescription("");
      setDate(new Date().toISOString().slice(0, 10));
    }
  }, [visible, accounts]);

  async function handleSave() {
    if (!accountId) {
      Alert.alert("Validation", "Select an account.");
      return;
    }
    if (!amount || isNaN(parseFloat(amount))) {
      Alert.alert("Validation", "Enter a valid amount.");
      return;
    }
    setSaving(true);
    try {
      await onSave({ account_id: accountId, type: txType, amount, category: category.trim(), description: description.trim(), date });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Transaction</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView>
            <Text style={styles.label}>Account *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {accounts.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.chip, accountId === a.id && styles.chipActive]}
                    onPress={() => setAccountId(a.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        accountId === a.id && styles.chipTextActive,
                      ]}
                    >
                      {a.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.label}>Type</Text>
            <View style={styles.chipRow}>
              {TX_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, txType === t && styles.chipActive]}
                  onPress={() => setTxType(t)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      txType === t && styles.chipTextActive,
                    ]}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Amount *</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor="#9ca3af"
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Category</Text>
            <TextInput
              style={styles.input}
              value={category}
              onChangeText={setCategory}
              placeholder="e.g. Food, Rent"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Optional note"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="2025-01-15"
              placeholderTextColor="#9ca3af"
            />
          </ScrollView>

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save Transaction</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FinanceScreen() {
  const api = useApi();

  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddTx, setShowAddTx] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [summRes, accRes, txRes] = await Promise.all([
        api.get("/finance/summary"),
        api.get("/accounts"),
        api.get("/transactions"),
      ]);
      setSummary(summRes.data as FinanceSummary);
      setAccounts((accRes.data as { data: Account[] }).data ?? []);
      setTransactions((txRes.data as { data: Transaction[] }).data ?? []);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.error ?? "Failed to load finance data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function onRefresh() {
    setRefreshing(true);
    loadData();
  }

  async function handleCreateAccount(data: {
    name: string;
    account_type: AccountType;
    currency: string;
    opening_balance: string;
  }) {
    try {
      await api.post("/accounts", {
        name: data.name,
        account_type: data.account_type,
        currency: data.currency,
        opening_balance: parseFloat(data.opening_balance) || 0,
      });
      setShowAddAccount(false);
      loadData();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.error ?? "Failed to create account.");
      throw e;
    }
  }

  async function handleCreateTransaction(data: {
    account_id: string;
    type: TransactionType;
    amount: string;
    category: string;
    description: string;
    date: string;
  }) {
    try {
      await api.post("/transactions", {
        account_id: data.account_id,
        type: data.type,
        amount: parseFloat(data.amount),
        category: data.category,
        description: data.description,
        date: data.date,
      });
      setShowAddTx(false);
      loadData();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.error ?? "Failed to save transaction.");
      throw e;
    }
  }

  const fmt = (n: number, currency = "USD") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

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
        data={transactions}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <>
            <SummaryCards summary={summary} />

            {/* Accounts section */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Accounts</Text>
              <TouchableOpacity
                style={styles.addChip}
                onPress={() => setShowAddAccount(true)}
              >
                <Ionicons name="add" size={16} color="#4f46e5" />
                <Text style={styles.addChipText}>Add</Text>
              </TouchableOpacity>
            </View>

            {accounts.length === 0 ? (
              <Text style={styles.emptyText}>No accounts yet.</Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.accountScroll}
              >
                {accounts.map((acc) => (
                  <View key={acc.id} style={styles.accountCard}>
                    <Text style={styles.accountName}>{acc.name}</Text>
                    <Text style={styles.accountType}>
                      {acc.account_type.replace("_", " ")}
                    </Text>
                    <Text
                      style={[
                        styles.accountBalance,
                        { color: acc.balance >= 0 ? "#16a34a" : "#dc2626" },
                      ]}
                    >
                      {fmt(acc.balance, acc.currency)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Transactions section */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Transactions</Text>
              <TouchableOpacity
                style={styles.addChip}
                onPress={() => setShowAddTx(true)}
              >
                <Ionicons name="add" size={16} color="#4f46e5" />
                <Text style={styles.addChipText}>Add</Text>
              </TouchableOpacity>
            </View>

            {transactions.length === 0 && (
              <Text style={styles.emptyText}>No transactions yet.</Text>
            )}
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.txRow}>
            <View
              style={[
                styles.txBadge,
                {
                  backgroundColor:
                    item.type === "income" ? "#dcfce7" : "#fee2e2",
                },
              ]}
            >
              <Ionicons
                name={item.type === "income" ? "arrow-down" : "arrow-up"}
                size={16}
                color={item.type === "income" ? "#16a34a" : "#dc2626"}
              />
            </View>
            <View style={styles.txInfo}>
              <Text style={styles.txCategory}>
                {item.category || "Uncategorized"}
              </Text>
              {item.description ? (
                <Text style={styles.txDescription}>{item.description}</Text>
              ) : null}
              <Text style={styles.txDate}>{item.date.slice(0, 10)}</Text>
            </View>
            <Text
              style={[
                styles.txAmount,
                { color: item.type === "income" ? "#16a34a" : "#dc2626" },
              ]}
            >
              {item.type === "income" ? "+" : "-"}
              {fmt(item.amount)}
            </Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddTx(true)}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <AddAccountModal
        visible={showAddAccount}
        onClose={() => setShowAddAccount(false)}
        onSave={handleCreateAccount}
      />
      <AddTransactionModal
        visible={showAddTx}
        accounts={accounts}
        onClose={() => setShowAddTx(false)}
        onSave={handleCreateTransaction}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Summary
  summaryRow: { padding: 16, gap: 8 },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 8,
  },
  summaryLabel: { fontSize: 12, color: "#6b7280", marginBottom: 4 },
  summaryValue: { fontSize: 22, fontWeight: "700" },

  // Sections
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  addChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#eef2ff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  addChipText: { fontSize: 13, color: "#4f46e5", fontWeight: "600" },
  emptyText: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 14,
    marginVertical: 12,
  },

  // Account cards
  accountScroll: { paddingLeft: 16, marginBottom: 16 },
  accountCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginRight: 12,
    minWidth: 140,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  accountName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  accountType: { fontSize: 12, color: "#6b7280", marginBottom: 6, textTransform: "capitalize" },
  accountBalance: { fontSize: 18, fontWeight: "700" },

  // Transactions
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  txBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  txInfo: { flex: 1 },
  txCategory: { fontSize: 14, fontWeight: "600", color: "#111827" },
  txDescription: { fontSize: 12, color: "#6b7280", marginTop: 1 },
  txDate: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: "700" },

  // FAB
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4f46e5",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4f46e5",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#f9fafb",
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
  },
  chipActive: { borderColor: "#4f46e5", backgroundColor: "#eef2ff" },
  chipText: { fontSize: 13, color: "#6b7280" },
  chipTextActive: { color: "#4f46e5", fontWeight: "600" },
  saveBtn: {
    backgroundColor: "#4f46e5",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
