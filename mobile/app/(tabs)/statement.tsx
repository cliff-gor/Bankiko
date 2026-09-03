import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { statementApi, StatementEntry } from "@/lib/api";

const TYPE_STYLE: Record<string, { label: string; bg: string; color: string; sign: string }> = {
  DEPOSIT:           { label: "Deposit",          bg: "#dcfce7", color: "#16a34a", sign: "+" },
  WITHDRAWAL:        { label: "Withdrawal",        bg: "#fee2e2", color: "#dc2626", sign: "-" },
  CONTRIBUTION:      { label: "Contribution",      bg: "#dbeafe", color: "#2563eb", sign: "-" },
  SHARE_PURCHASE:    { label: "Shares",            bg: "#ede9fe", color: "#7c3aed", sign: "-" },
  LOAN_DISBURSEMENT: { label: "Loan In",           bg: "#d1fae5", color: "#059669", sign: "+" },
  LOAN_REPAYMENT:    { label: "Loan Repaid",       bg: "#ffedd5", color: "#c2410c", sign: "-" },
};

export default function StatementScreen() {
  const [entries, setEntries] = useState<StatementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await statementApi.list();
      setEntries(data);
    } catch {
      Toast.show({ type: "error", text1: "Could not load statement" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={entries}
      keyExtractor={(e) => e.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#16a34a" />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.heading}>Statement</Text>
          <Text style={styles.sub}>{entries.length} transactions</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="document-text-outline" size={64} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptyBody}>Your full financial history appears here once you start transacting.</Text>
        </View>
      }
      renderItem={({ item: e }) => {
        const style = TYPE_STYLE[e.type] ?? { label: e.type, bg: "#f3f4f6", color: "#6b7280", sign: "+" };
        const isCredit = style.sign === "+";
        return (
          <View style={styles.row}>
            <View style={[styles.typeBadge, { backgroundColor: style.bg }]}>
              <Text style={[styles.typeLabel, { color: style.color }]}>{style.label}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.desc} numberOfLines={2}>{e.description}</Text>
              {e.reference ? <Text style={styles.ref}>Ref: {e.reference}</Text> : null}
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.amount, { color: isCredit ? "#16a34a" : "#111827" }]}>
                {style.sign}KES {Number(e.amount).toLocaleString("en-KE")}
              </Text>
              <Text style={styles.date}>
                {e.createdAt ? new Date(e.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" }) : "—"}
              </Text>
            </View>
          </View>
        );
      }}
      contentContainerStyle={{ paddingBottom: 32 }}
    />
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: "#f9fafb" },
  center:     { flex: 1, justifyContent: "center", alignItems: "center" },
  header:     { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  heading:    { fontSize: 22, fontWeight: "700", color: "#111827" },
  sub:        { fontSize: 13, color: "#9ca3af", marginTop: 2 },
  empty:      { alignItems: "center", paddingTop: 60, paddingHorizontal: 40, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: "#374151" },
  emptyBody:  { textAlign: "center", color: "#9ca3af", lineHeight: 20 },
  row:        { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, marginBottom: 8, backgroundColor: "#fff", borderRadius: 12, padding: 14, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  typeBadge:  { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, minWidth: 64, alignItems: "center" },
  typeLabel:  { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  desc:       { fontSize: 13, color: "#111827", fontWeight: "500", flexShrink: 1 },
  ref:        { fontSize: 11, color: "#9ca3af", marginTop: 1 },
  amount:     { fontSize: 14, fontWeight: "700", tabularNums: true } as any,
  date:       { fontSize: 11, color: "#9ca3af", marginTop: 1 },
});
