import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { walletApi, memberApi, WalletBalance, MpesaTransactionResponse } from "@/lib/api";
import { storage } from "@/lib/storage";

type Action = "deposit" | "withdraw" | null;
type Tab = "wallet" | "history";

const STATUS_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  SUCCESS: "checkmark-circle",
  PENDING: "time-outline",
  FAILED:  "close-circle",
  TIMEOUT: "alert-circle-outline",
};
const STATUS_COLOR: Record<string, string> = {
  SUCCESS: "#16a34a",
  PENDING: "#d97706",
  FAILED:  "#ef4444",
  TIMEOUT: "#6b7280",
};
const TYPE_LABEL: Record<string, string> = {
  DEPOSIT:      "Deposit",
  WITHDRAWAL:   "Withdrawal",
  CONTRIBUTION: "Contribution",
};

export default function WalletScreen() {
  const [tab, setTab] = useState<Tab>("wallet");
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [transactions, setTransactions] = useState<MpesaTransactionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [action, setAction] = useState<Action>(null);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadBalance = useCallback(async () => {
    try {
      const m = await memberApi.me().catch(() => null);
      if (!m || m.status === "PENDING_ONBOARDING") await memberApi.onboard();
      const b = await walletApi.balance();
      setBalance(b);
    } catch (err: any) {
      Toast.show({ type: "error", text1: err?.detail ?? "Failed to load wallet" });
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const data = await walletApi.transactions();
      setTransactions(data.content);
    } catch {
      /* silent */
    } finally {
      setTxLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    await loadBalance();
    await loadTransactions();
    setLoading(false);
    setRefreshing(false);
  }, [loadBalance, loadTransactions]);

  useEffect(() => { load(); }, [load]);

  // Pre-fill phone from stored user
  useEffect(() => {
    storage.getUser<{ phone?: string }>().then((u) => {
      if (u?.phone) setPhone(u.phone);
    });
  }, []);

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  function startBalancePolling(previousBalance: number) {
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const b = await walletApi.balance();
        setBalance(b);
        if (b.availableBalance > previousBalance || attempts >= 8) {
          stopPolling();
          if (b.availableBalance > previousBalance) {
            await loadTransactions();
            Toast.show({ type: "success", text1: `Balance updated: KES ${b.availableBalance.toLocaleString("en-KE", { minimumFractionDigits: 2 })}` });
          }
        }
      } catch {
        stopPolling();
      }
    }, 2500);
  }

  useEffect(() => () => stopPolling(), []);

  async function handleSubmit() {
    if (!amount || !phone) {
      Toast.show({ type: "error", text1: "Enter amount and phone number" });
      return;
    }
    setSubmitting(true);
    const prevBalance = balance?.availableBalance ?? 0;
    try {
      if (action === "deposit") {
        await walletApi.deposit(parseFloat(amount), phone);
        Toast.show({ type: "success", text1: "STK Push sent — check your phone", text2: "Balance will update automatically" });
        startBalancePolling(prevBalance);
      } else {
        await walletApi.withdraw(parseFloat(amount), phone);
        Toast.show({ type: "success", text1: "Withdrawal initiated" });
        await loadBalance();
      }
      setAction(null);
      setAmount("");
    } catch (err: any) {
      Toast.show({ type: "error", text1: err?.detail ?? "Transaction failed" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#16a34a" />}
      >
        {/* Balance card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Wallet Balance</Text>
          <Text style={styles.balanceAmount}>
            KES {balance?.availableBalance.toLocaleString("en-KE", { minimumFractionDigits: 2 }) ?? "0.00"}
          </Text>
          {balance?.accountNo && (
            <Text style={styles.balanceSub}>Account: {balance.accountNo}</Text>
          )}
        </View>

        {/* Tab switcher */}
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tabBtn, tab === "wallet" && styles.tabBtnActive]} onPress={() => setTab("wallet")}>
            <Text style={[styles.tabText, tab === "wallet" && styles.tabTextActive]}>Actions</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, tab === "history" && styles.tabBtnActive]} onPress={() => setTab("history")}>
            <Text style={[styles.tabText, tab === "history" && styles.tabTextActive]}>History</Text>
          </TouchableOpacity>
        </View>

        {tab === "wallet" && (
          <>
            {/* Action buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionBtn, action === "deposit" && styles.actionBtnActive]}
                onPress={() => setAction(action === "deposit" ? null : "deposit")}
              >
                <Ionicons name="arrow-down-circle-outline" size={18} color={action === "deposit" ? "#fff" : "#16a34a"} />
                <Text style={[styles.actionBtnText, action === "deposit" && styles.actionBtnTextActive]}>Deposit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, action === "withdraw" && styles.actionBtnActive]}
                onPress={() => setAction(action === "withdraw" ? null : "withdraw")}
              >
                <Ionicons name="arrow-up-circle-outline" size={18} color={action === "withdraw" ? "#fff" : "#16a34a"} />
                <Text style={[styles.actionBtnText, action === "withdraw" && styles.actionBtnTextActive]}>Withdraw</Text>
              </TouchableOpacity>
            </View>

            {action && (
              <View style={styles.form}>
                <Text style={styles.formTitle}>{action === "deposit" ? "Deposit via M-Pesa" : "Withdraw to M-Pesa"}</Text>

                <Text style={styles.label}>Amount (KES)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="500"
                  value={amount}
                  onChangeText={setAmount}
                />

                <Text style={styles.label}>M-Pesa Phone</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="phone-pad"
                  placeholder="0712345678"
                  value={phone}
                  onChangeText={setPhone}
                />

                <TouchableOpacity
                  style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitBtnText}>
                      {action === "deposit" ? "Send STK Push" : "Withdraw"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {tab === "history" && (
          <View style={styles.historySection}>
            {txLoading ? (
              <ActivityIndicator color="#16a34a" style={{ marginTop: 32 }} />
            ) : transactions.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="receipt-outline" size={56} color="#d1d5db" />
                <Text style={styles.emptyTitle}>No transactions yet</Text>
                <Text style={styles.emptyBody}>Your deposits and withdrawals will appear here.</Text>
              </View>
            ) : (
              transactions.map((tx) => (
                <View key={tx.id} style={styles.txRow}>
                  <View style={[styles.txIcon, { backgroundColor: STATUS_COLOR[tx.status] + "18" }]}>
                    <Ionicons name={STATUS_ICON[tx.status]} size={20} color={STATUS_COLOR[tx.status]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txType}>{TYPE_LABEL[tx.type] ?? tx.type}</Text>
                    <Text style={styles.txDate}>{new Date(tx.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</Text>
                    {tx.mpesaReceiptNumber && (
                      <Text style={styles.txReceipt}>Ref: {tx.mpesaReceiptNumber}</Text>
                    )}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.txAmount, { color: tx.type === "WITHDRAWAL" ? "#ef4444" : "#16a34a" }]}>
                      {tx.type === "WITHDRAWAL" ? "-" : "+"}KES {tx.amount.toLocaleString("en-KE")}
                    </Text>
                    <View style={[styles.txBadge, { backgroundColor: STATUS_COLOR[tx.status] + "18" }]}>
                      <Text style={[styles.txBadgeText, { color: STATUS_COLOR[tx.status] }]}>{tx.status}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: "#f9fafb" },
  center:          { flex: 1, justifyContent: "center", alignItems: "center" },
  balanceCard:     { margin: 20, backgroundColor: "#16a34a", borderRadius: 16, padding: 28 },
  balanceLabel:    { color: "rgba(255,255,255,0.75)", fontSize: 13, marginBottom: 8 },
  balanceAmount:   { color: "#fff", fontSize: 32, fontWeight: "700" },
  balanceSub:      { color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 4 },
  tabRow:          { flexDirection: "row", marginHorizontal: 20, marginBottom: 16, backgroundColor: "#e5e7eb", borderRadius: 10, padding: 3 },
  tabBtn:          { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  tabBtnActive:    { backgroundColor: "#fff" },
  tabText:         { fontWeight: "600", color: "#6b7280", fontSize: 14 },
  tabTextActive:   { color: "#111827" },
  actions:         { flexDirection: "row", paddingHorizontal: 20, gap: 12, marginBottom: 16 },
  actionBtn:       { flex: 1, flexDirection: "row", gap: 6, borderWidth: 1.5, borderColor: "#16a34a", borderRadius: 10, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  actionBtnActive: { backgroundColor: "#16a34a" },
  actionBtnText:   { fontWeight: "600", color: "#16a34a" },
  actionBtnTextActive: { color: "#fff" },
  form:            { marginHorizontal: 20, backgroundColor: "#fff", borderRadius: 16, padding: 20, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  formTitle:       { fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 16 },
  label:           { fontSize: 14, fontWeight: "500", color: "#374151", marginBottom: 6 },
  input:           { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: "#111827", marginBottom: 14 },
  submitBtn:       { backgroundColor: "#16a34a", borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText:   { color: "#fff", fontWeight: "600", fontSize: 16 },
  historySection:  { paddingHorizontal: 20 },
  empty:           { alignItems: "center", marginTop: 48, paddingHorizontal: 32, gap: 10 },
  emptyTitle:      { fontSize: 17, fontWeight: "600", color: "#374151" },
  emptyBody:       { textAlign: "center", color: "#9ca3af", lineHeight: 20 },
  txRow:           { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  txIcon:          { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  txType:          { fontWeight: "600", color: "#111827", fontSize: 14 },
  txDate:          { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  txReceipt:       { fontSize: 11, color: "#d1d5db", marginTop: 1 },
  txAmount:        { fontWeight: "700", fontSize: 15 },
  txBadge:         { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
  txBadgeText:     { fontSize: 10, fontWeight: "600" },
});
