import { useEffect, useState, useCallback } from "react";
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
import Toast from "react-native-toast-message";
import { walletApi, memberApi, WalletBalance } from "@/lib/api";
import { storage } from "@/lib/storage";

type Action = "deposit" | "withdraw" | null;

export default function WalletScreen() {
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [action, setAction] = useState<Action>(null);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      // ensure member is onboarded first
      const m = await memberApi.me().catch(() => null);
      if (m && !m.savingsAccountId) {
        await memberApi.onboard();
      }
      const b = await walletApi.balance();
      setBalance(b);
    } catch (err: any) {
      Toast.show({ type: "error", text1: err?.detail ?? "Failed to load wallet" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit() {
    if (!amount || !phone) {
      Toast.show({ type: "error", text1: "Enter amount and phone number" });
      return;
    }
    setSubmitting(true);
    try {
      if (action === "deposit") {
        await walletApi.deposit(parseFloat(amount), phone);
        Toast.show({ type: "success", text1: "STK Push sent — check your phone" });
      } else {
        await walletApi.withdraw(parseFloat(amount), phone);
        Toast.show({ type: "success", text1: "Withdrawal initiated" });
      }
      setAction(null);
      setAmount("");
      setPhone("");
      load();
    } catch (err: any) {
      Toast.show({ type: "error", text1: err?.detail ?? "Transaction failed" });
    } finally {
      setSubmitting(false);
    }
  }

  const user = storage.getUser<{ phoneNumber?: string }>();

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
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Wallet Balance</Text>
          <Text style={styles.balanceAmount}>
            KES {balance?.balance.toLocaleString("en-KE", { minimumFractionDigits: 2 }) ?? "0.00"}
          </Text>
          <Text style={styles.balanceCurrency}>{balance?.currency ?? "KES"} account</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, action === "deposit" && styles.actionBtnActive]}
            onPress={() => setAction(action === "deposit" ? null : "deposit")}
          >
            <Text style={[styles.actionBtnText, action === "deposit" && styles.actionBtnTextActive]}>Deposit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, action === "withdraw" && styles.actionBtnActive]}
            onPress={() => setAction(action === "withdraw" ? null : "withdraw")}
          >
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

            <Text style={styles.label}>Phone number</Text>
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  balanceCard: { margin: 20, backgroundColor: "#16a34a", borderRadius: 16, padding: 28 },
  balanceLabel: { color: "rgba(255,255,255,0.75)", fontSize: 13, marginBottom: 8 },
  balanceAmount: { color: "#fff", fontSize: 32, fontWeight: "700" },
  balanceCurrency: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 4 },
  actions: { flexDirection: "row", paddingHorizontal: 20, gap: 12, marginBottom: 16 },
  actionBtn: { flex: 1, borderWidth: 1.5, borderColor: "#16a34a", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  actionBtnActive: { backgroundColor: "#16a34a" },
  actionBtnText: { fontWeight: "600", color: "#16a34a" },
  actionBtnTextActive: { color: "#fff" },
  form: { marginHorizontal: 20, backgroundColor: "#fff", borderRadius: 16, padding: 20, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  formTitle: { fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "500", color: "#374151", marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: "#111827", marginBottom: 14 },
  submitBtn: { backgroundColor: "#16a34a", borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
