import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import Toast from "react-native-toast-message";
import { memberApi, walletApi, groupApi, MemberResponse, WalletBalance, GroupResponse } from "@/lib/api";
import { storage } from "@/lib/storage";

export default function DashboardScreen() {
  const [member, setMember] = useState<MemberResponse | null>(null);
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, b, g] = await Promise.allSettled([
        memberApi.me(),
        walletApi.balance(),
        groupApi.list(),
      ]);
      if (m.status === "fulfilled") setMember(m.value);
      if (b.status === "fulfilled") setBalance(b.value);
      if (g.status === "fulfilled") setGroups(g.value);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleLogout() {
    await storage.clear();
    router.replace("/(auth)/login");
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  const needsOnboarding = member && !member.savingsAccountId;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#16a34a" />}
    >
      <View style={styles.topBar}>
        <View>
          <Text style={styles.greeting}>Hello, {member?.fullName?.split(" ")[0] ?? "there"} 👋</Text>
          <Text style={styles.subGreeting}>Welcome back to Bankiko</Text>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {needsOnboarding && (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Complete your wallet setup</Text>
          <Text style={styles.bannerBody}>Tap below to activate your savings account on Fineract.</Text>
          <TouchableOpacity
            style={styles.bannerButton}
            onPress={async () => {
              try {
                await memberApi.onboard();
                Toast.show({ type: "success", text1: "Wallet activated!" });
                load();
              } catch {
                Toast.show({ type: "error", text1: "Onboarding failed. Try again." });
              }
            }}
          >
            <Text style={styles.bannerButtonText}>Activate wallet</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmount}>
          {balance ? `KES ${balance.balance.toLocaleString("en-KE", { minimumFractionDigits: 2 })}` : "—"}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={styles.quickActions}>
          {[
            { label: "Wallet", route: "/(tabs)/wallet" as const },
            { label: "Groups", route: "/(tabs)/groups" as const },
            { label: "Loans", route: "/(tabs)/loans" as const },
          ].map(({ label, route }) => (
            <TouchableOpacity key={label} style={styles.quickCard} onPress={() => router.push(route)}>
              <Text style={styles.quickCardText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {groups.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My groups ({groups.length})</Text>
          {groups.slice(0, 3).map((g) => (
            <View key={g.id} style={styles.groupRow}>
              <View style={styles.groupAvatar}>
                <Text style={styles.groupAvatarText}>{g.name[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.groupName}>{g.name}</Text>
                <Text style={styles.groupMeta}>{g.memberCount} members · {g.role}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 20, paddingTop: 24 },
  greeting: { fontSize: 20, fontWeight: "700", color: "#111827" },
  subGreeting: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  logoutText: { fontSize: 13, color: "#ef4444", fontWeight: "500" },
  banner: { marginHorizontal: 20, marginBottom: 16, backgroundColor: "#fef3c7", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#fcd34d" },
  bannerTitle: { fontWeight: "600", color: "#92400e", marginBottom: 4 },
  bannerBody: { fontSize: 13, color: "#78350f", marginBottom: 12 },
  bannerButton: { backgroundColor: "#d97706", borderRadius: 8, paddingVertical: 9, alignItems: "center" },
  bannerButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  balanceCard: { marginHorizontal: 20, backgroundColor: "#16a34a", borderRadius: 16, padding: 24, marginBottom: 20 },
  balanceLabel: { color: "rgba(255,255,255,0.8)", fontSize: 13, marginBottom: 8 },
  balanceAmount: { color: "#fff", fontSize: 30, fontWeight: "700" },
  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: "#374151", marginBottom: 12 },
  quickActions: { flexDirection: "row", gap: 10 },
  quickCard: { flex: 1, backgroundColor: "#fff", borderRadius: 12, paddingVertical: 18, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  quickCardText: { fontWeight: "600", color: "#16a34a", fontSize: 14 },
  groupRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  groupAvatar: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#dcfce7", justifyContent: "center", alignItems: "center" },
  groupAvatarText: { color: "#16a34a", fontWeight: "700", fontSize: 16 },
  groupName: { fontWeight: "600", color: "#111827", fontSize: 15 },
  groupMeta: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
});
