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
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { loanApi, groupApi, memberApi, LoanResponse, LoanRepayment, GroupResponse } from "@/lib/api";

const STATUS_COLOR: Record<string, string> = {
  PENDING_APPROVAL: "#d97706",
  APPROVED:         "#2563eb",
  ACTIVE:           "#16a34a",
  CLOSED:           "#6b7280",
  REJECTED:         "#ef4444",
};
const STATUS_LABEL: Record<string, string> = {
  PENDING_APPROVAL: "Pending",
  APPROVED:         "Approved",
  ACTIVE:           "Active",
  CLOSED:           "Closed",
  REJECTED:         "Rejected",
};

export default function LoansScreen() {
  const insets = useSafeAreaInsets();
  const [loans, setLoans] = useState<LoanResponse[]>([]);
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [applyModal, setApplyModal] = useState(false);
  const [repayModal, setRepayModal] = useState<LoanResponse | null>(null);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [principal, setPrincipal] = useState("");
  const [months, setMonths] = useState("3");
  const [purpose, setPurpose] = useState("");
  const [applying, setApplying] = useState(false);
  const [repayAmount, setRepayAmount] = useState("");
  const [repaying, setRepaying] = useState(false);
  const [scheduleMap, setScheduleMap] = useState<Record<string, LoanRepayment[]>>({});
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const m = await memberApi.me().catch(() => null);
      if (!m || m.status === "PENDING_ONBOARDING") await memberApi.onboard().catch(() => null);
      const [l, g] = await Promise.allSettled([loanApi.list(), groupApi.list()]);
      if (l.status === "fulfilled") setLoans(l.value);
      if (g.status === "fulfilled") {
        setGroups(g.value);
        if (g.value.length > 0) setSelectedGroup(prev => prev || g.value[0].id);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleSchedule(loanId: string) {
    if (expandedLoan === loanId) { setExpandedLoan(null); return; }
    setExpandedLoan(loanId);
    if (!scheduleMap[loanId]) {
      try {
        const schedule = await loanApi.schedule(loanId);
        setScheduleMap(prev => ({ ...prev, [loanId]: schedule }));
      } catch { /* ignore */ }
    }
  }

  async function handleApply() {
    if (!selectedGroup || !principal) {
      Toast.show({ type: "error", text1: "Select a group and enter an amount" });
      return;
    }
    setApplying(true);
    try {
      await loanApi.apply(selectedGroup, parseFloat(principal), parseInt(months), purpose);
      Toast.show({ type: "success", text1: "Loan application submitted" });
      setApplyModal(false);
      setPrincipal(""); setMonths("3"); setPurpose(""); setSelectedGroup(groups[0]?.id ?? "");
      load();
    } catch (err: any) {
      Toast.show({ type: "error", text1: err?.detail ?? err?.message ?? "Application failed", text2: err?.status ? `Status ${err.status}` : undefined });
    } finally {
      setApplying(false);
    }
  }

  async function handleRepay() {
    if (!repayAmount || !repayModal) return;
    setRepaying(true);
    try {
      await loanApi.repay(repayModal.id, parseFloat(repayAmount));
      Toast.show({ type: "success", text1: "Repayment submitted" });
      setRepayModal(null);
      setRepayAmount("");
      load();
    } catch (err: any) {
      Toast.show({ type: "error", text1: err?.detail ?? "Repayment failed" });
    } finally {
      setRepaying(false);
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
          <TouchableOpacity style={styles.applyBtn} onPress={() => setApplyModal(true)}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.applyBtnText}>Apply</Text>
          </TouchableOpacity>
        </View>

        {loans.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="card-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No loans yet</Text>
            <Text style={styles.emptyBody}>Apply for a loan from your SACCO group pool. Your group admin will review it.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setApplyModal(true)}>
              <Text style={styles.emptyBtnText}>Apply for a loan</Text>
            </TouchableOpacity>
          </View>
        ) : (
          loans.map((l) => {
            const isActive = l.status === "ACTIVE";
            return (
              <View key={l.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardGroup}>{l.groupName}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLOR[l.status] ?? "#6b7280") + "20" }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLOR[l.status] ?? "#6b7280" }]}>
                      {STATUS_LABEL[l.status] ?? l.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardAmount}>KES {Number(l.principal).toLocaleString("en-KE")}</Text>
                <Text style={styles.cardMeta}>{l.repaymentMonths} months repayment</Text>
                {l.disbursedAt && (
                  <Text style={styles.cardMeta}>Disbursed {new Date(l.disbursedAt).toLocaleDateString("en-KE")}</Text>
                )}
                {l.purpose && <Text style={styles.cardMeta}>Purpose: {l.purpose}</Text>}
                {isActive && (
                  <View style={{ gap: 8, marginTop: 10 }}>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity style={styles.repayBtn} onPress={() => { setRepayModal(l); setRepayAmount(""); }}>
                        <Ionicons name="arrow-up-circle-outline" size={16} color="#fff" />
                        <Text style={styles.repayBtnText}>Repay</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.repayBtn, { backgroundColor: "#1d4ed8" }]}
                        onPress={() => toggleSchedule(l.id)}
                      >
                        <Ionicons name="calendar-outline" size={16} color="#fff" />
                        <Text style={styles.repayBtnText}>{expandedLoan === l.id ? "Hide" : "Schedule"}</Text>
                      </TouchableOpacity>
                    </View>
                    {expandedLoan === l.id && scheduleMap[l.id] && (
                      <View style={{ backgroundColor: "#f8fafc", borderRadius: 10, padding: 12, gap: 6 }}>
                        {scheduleMap[l.id].map((inst) => (
                          <View key={inst.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                            <Text style={{ fontSize: 12, color: "#374151" }}>#{inst.installmentNo} · {inst.dueDate}</Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                              <Text style={{ fontSize: 12, fontWeight: "600", color: "#111827" }}>
                                KES {Number(inst.amountDue).toLocaleString("en-KE")}
                              </Text>
                              <View style={{
                                backgroundColor: inst.status === "PAID" ? "#dcfce7" : inst.status === "OVERDUE" ? "#fee2e2" : "#fef3c7",
                                borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2
                              }}>
                                <Text style={{
                                  fontSize: 10, fontWeight: "600",
                                  color: inst.status === "PAID" ? "#16a34a" : inst.status === "OVERDUE" ? "#dc2626" : "#92400e"
                                }}>{inst.status}</Text>
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Apply modal */}
      <Modal visible={applyModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.modal, { maxHeight: "75%", paddingBottom: 0 }]}>
            <Text style={styles.modalTitle}>Apply for a loan</Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Group</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {groups.length === 0 ? (
                  <Text style={{ color: "#9ca3af", fontSize: 13, paddingVertical: 8 }}>Join a group first</Text>
                ) : (
                  groups.map((g) => (
                    <TouchableOpacity
                      key={g.id}
                      style={[styles.groupChip, selectedGroup === g.id && styles.groupChipActive]}
                      onPress={() => setSelectedGroup(g.id)}
                    >
                      <Text style={[styles.groupChipText, selectedGroup === g.id && styles.groupChipTextActive]}>{g.name}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>

              <Text style={styles.label}>Amount (KES)</Text>
              <TextInput style={styles.input} keyboardType="numeric" placeholder="10000" value={principal} onChangeText={setPrincipal} />

              <Text style={styles.label}>Repayment (months)</Text>
              <TextInput style={styles.input} keyboardType="numeric" placeholder="3" value={months} onChangeText={setMonths} />

              <Text style={styles.label}>Purpose (optional)</Text>
              <TextInput style={styles.input} placeholder="School fees, business..." value={purpose} onChangeText={setPurpose} />
            </ScrollView>

            <View style={[styles.modalActions, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setApplyModal(false); setPrincipal(""); setMonths("3"); setPurpose(""); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, applying && styles.submitBtnDisabled]} onPress={handleApply} disabled={applying}>
                {applying ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Repay modal */}
      <Modal visible={!!repayModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.modal, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
            <Text style={styles.modalTitle}>Make a repayment</Text>
            <Text style={styles.modalSub}>Loan: KES {Number(repayModal?.principal ?? 0).toLocaleString("en-KE")} · {repayModal?.groupName}</Text>

            <Text style={styles.label}>Repayment amount (KES)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="e.g. 5000"
              value={repayAmount}
              onChangeText={setRepayAmount}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setRepayModal(null); setRepayAmount(""); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, repaying && styles.submitBtnDisabled]} onPress={handleRepay} disabled={repaying}>
                {repaying ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Repay</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: "#f9fafb" },
  center:             { flex: 1, justifyContent: "center", alignItems: "center" },
  header:             { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20 },
  heading:            { fontSize: 20, fontWeight: "700", color: "#111827" },
  applyBtn:           { flexDirection: "row", gap: 4, alignItems: "center", backgroundColor: "#16a34a", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  applyBtnText:       { color: "#fff", fontWeight: "600", fontSize: 13 },
  empty:              { alignItems: "center", marginTop: 48, paddingHorizontal: 40, gap: 10 },
  emptyTitle:         { fontSize: 17, fontWeight: "600", color: "#374151" },
  emptyBody:          { textAlign: "center", color: "#9ca3af", lineHeight: 20 },
  emptyBtn:           { marginTop: 8, backgroundColor: "#16a34a", borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText:       { color: "#fff", fontWeight: "600", fontSize: 14 },
  card:               { marginHorizontal: 20, marginBottom: 12, backgroundColor: "#fff", borderRadius: 14, padding: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, gap: 4 },
  cardRow:            { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardGroup:          { fontWeight: "600", color: "#374151", fontSize: 14 },
  statusBadge:        { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  statusText:         { fontSize: 11, fontWeight: "600" },
  cardAmount:         { fontSize: 22, fontWeight: "700", color: "#111827" },
  cardMeta:           { fontSize: 12, color: "#9ca3af" },
  repayBtn:           { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, backgroundColor: "#16a34a", borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14, alignSelf: "flex-start" },
  repayBtnText:       { color: "#fff", fontWeight: "600", fontSize: 13 },
  overlay:            { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modal:              { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle:         { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 4 },
  modalSub:           { fontSize: 13, color: "#6b7280", marginBottom: 16 },
  label:              { fontSize: 14, fontWeight: "500", color: "#374151", marginBottom: 6 },
  input:              { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: "#111827", marginBottom: 14 },
  groupChip:          { borderWidth: 1.5, borderColor: "#d1d5db", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
  groupChipActive:    { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  groupChipText:      { fontWeight: "500", color: "#374151", fontSize: 13 },
  groupChipTextActive: { color: "#fff" },
  modalActions:       { flexDirection: "row", gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  cancelBtn:          { flex: 1, borderWidth: 1.5, borderColor: "#d1d5db", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  cancelBtnText:      { fontWeight: "600", color: "#374151" },
  submitBtn:          { flex: 1, backgroundColor: "#16a34a", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  submitBtnDisabled:  { opacity: 0.6 },
  submitBtnText:      { color: "#fff", fontWeight: "600", fontSize: 15 },
});
