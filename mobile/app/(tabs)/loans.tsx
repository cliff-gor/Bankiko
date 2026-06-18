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
  Modal,
} from "react-native";
import Toast from "react-native-toast-message";
import { loanApi, groupApi, LoanResponse, GroupResponse } from "@/lib/api";

const STATUS_COLOR: Record<string, string> = {
  PENDING: "#d97706",
  APPROVED: "#2563eb",
  ACTIVE: "#16a34a",
  CLOSED: "#6b7280",
  REJECTED: "#ef4444",
};

export default function LoansScreen() {
  const [loans, setLoans] = useState<LoanResponse[]>([]);
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [principal, setPrincipal] = useState("");
  const [months, setMonths] = useState("3");
  const [purpose, setPurpose] = useState("");
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    try {
      const [l, g] = await Promise.allSettled([loanApi.list(), groupApi.list()]);
      if (l.status === "fulfilled") setLoans(l.value);
      if (g.status === "fulfilled") setGroups(g.value);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleApply() {
    if (!selectedGroup || !principal) {
      Toast.show({ type: "error", text1: "Select a group and enter an amount" });
      return;
    }
    setApplying(true);
    try {
      await loanApi.apply(selectedGroup, parseFloat(principal), parseInt(months), purpose);
      Toast.show({ type: "success", text1: "Loan application submitted" });
      setModalVisible(false);
      setPrincipal(""); setMonths("3"); setPurpose(""); setSelectedGroup("");
      load();
    } catch (err: any) {
      Toast.show({ type: "error", text1: err?.detail ?? "Application failed" });
    } finally {
      setApplying(false);
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
    <>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#16a34a" />}
      >
        <View style={styles.header}>
          <Text style={styles.heading}>My loans</Text>
          <TouchableOpacity style={styles.applyBtn} onPress={() => setModalVisible(true)}>
            <Text style={styles.applyBtnText}>+ Apply</Text>
          </TouchableOpacity>
        </View>

        {loans.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No loans yet</Text>
            <Text style={styles.emptyBody}>Apply for a loan from your SACCO group pool.</Text>
          </View>
        ) : (
          loans.map((l) => (
            <View key={l.id} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardGroup}>{l.groupName}</Text>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[l.status] + "20" }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLOR[l.status] }]}>{l.status}</Text>
                </View>
              </View>
              <Text style={styles.cardAmount}>KES {l.principal.toLocaleString("en-KE")}</Text>
              <Text style={styles.cardMeta}>{l.repaymentMonths} months repayment</Text>
              {l.disbursedAt && (
                <Text style={styles.cardMeta}>Disbursed {new Date(l.disbursedAt).toLocaleDateString("en-KE")}</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Apply for a loan</Text>

            <Text style={styles.label}>Group</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {groups.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.groupChip, selectedGroup === g.id && styles.groupChipActive]}
                  onPress={() => setSelectedGroup(g.id)}
                >
                  <Text style={[styles.groupChipText, selectedGroup === g.id && styles.groupChipTextActive]}>{g.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Amount (KES)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="10000"
              value={principal}
              onChangeText={setPrincipal}
            />

            <Text style={styles.label}>Repayment (months)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="3"
              value={months}
              onChangeText={setMonths}
            />

            <Text style={styles.label}>Purpose (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="School fees, business..."
              value={purpose}
              onChangeText={setPurpose}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setModalVisible(false); }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, applying && styles.submitBtnDisabled]}
                onPress={handleApply}
                disabled={applying}
              >
                {applying ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20 },
  heading: { fontSize: 20, fontWeight: "700", color: "#111827" },
  applyBtn: { backgroundColor: "#16a34a", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  applyBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  empty: { alignItems: "center", marginTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: "#374151", marginBottom: 8 },
  emptyBody: { textAlign: "center", color: "#9ca3af", lineHeight: 20 },
  card: { marginHorizontal: 20, marginBottom: 12, backgroundColor: "#fff", borderRadius: 14, padding: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  cardGroup: { fontWeight: "600", color: "#374151", fontSize: 14 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: "600" },
  cardAmount: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 4 },
  cardMeta: { fontSize: 12, color: "#9ca3af" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modal: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "500", color: "#374151", marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: "#111827", marginBottom: 14 },
  groupChip: { borderWidth: 1.5, borderColor: "#d1d5db", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
  groupChipActive: { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  groupChipText: { fontWeight: "500", color: "#374151", fontSize: 13 },
  groupChipTextActive: { color: "#fff" },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 4 },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderColor: "#d1d5db", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  cancelBtnText: { fontWeight: "600", color: "#374151" },
  submitBtn: { flex: 1, backgroundColor: "#16a34a", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
