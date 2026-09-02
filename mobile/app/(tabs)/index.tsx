import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { memberApi, walletApi, groupApi, MemberResponse, WalletBalance, GroupResponse } from "@/lib/api";

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
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

  useFocusEffect(load);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  const needsOnboarding = !member || member.status === "PENDING_ONBOARDING";

  const quickActions: { label: string; sub: string; icon: keyof typeof Ionicons.glyphMap; route: "/(tabs)/wallet" | "/(tabs)/groups" | "/(tabs)/loans" }[] = [
    { label: "Wallet", sub: "Save & deposit", icon: "wallet-outline", route: "/(tabs)/wallet" },
    { label: "Groups", sub: "SACCO groups",   icon: "people-outline", route: "/(tabs)/groups" },
    { label: "Loans",  sub: "Borrow funds",   icon: "card-outline",   route: "/(tabs)/loans"  },
  ];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#16a34a" />}
    >
      {/* Top bar — safe area aware */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.greeting}>Hello, {member?.fullName?.split(" ")[0] ?? "there"}</Text>
          <Text style={styles.subGreeting}>Welcome back to Bankiko</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/(tabs)/profile")} style={styles.avatarBtn}>
          <Ionicons name="person-circle-outline" size={32} color="#6b7280" />
        </TouchableOpacity>
      </View>

      {needsOnboarding && (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Complete your wallet setup</Text>
          <Text style={styles.bannerBody}>Activate your savings account to start transacting.</Text>
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

      {/* Balance card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmount}>
          {balance ? `KES ${balance.availableBalance.toLocaleString("en-KE", { minimumFractionDigits: 2 })}` : "—"}
        </Text>
        <TouchableOpacity style={styles.historyLink} onPress={() => router.push("/(tabs)/wallet")}>
          <Text style={styles.historyLinkText}>View history</Text>
          <Ionicons name="chevron-forward" size={13} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

      {/* Quick actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={styles.quickActions}>
          {quickActions.map(({ label, sub, icon, route }) => (
            <TouchableOpacity key={label} style={styles.quickCard} onPress={() => router.push(route)}>
              <View style={styles.quickIconWrap}>
                <Ionicons name={icon} size={22} color="#16a34a" />
              </View>
              <Text style={styles.quickCardText}>{label}</Text>
              <Text style={styles.quickCardSub}>{sub}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* My groups */}
      {groups.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>My groups ({groups.length})</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/groups")}>
              <Text style={styles.sectionLink}>See all</Text>
            </TouchableOpacity>
          </View>
          {groups.slice(0, 3).map((g) => (
            <TouchableOpacity key={g.id} style={styles.groupRow} onPress={() => router.push(`/(tabs)/groups/${g.id}` as any)}>
              <View style={styles.groupAvatar}>
                <Text style={styles.groupAvatarText}>{g.name[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.groupName}>{g.name}</Text>
                <Text style={styles.groupMeta}>{g.memberCount} members · {g.role}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "#f9fafb" },
  center:           { flex: 1, justifyContent: "center", alignItems: "center" },
  topBar:           { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 4 },
  greeting:         { fontSize: 20, fontWeight: "700", color: "#111827" },
  subGreeting:      { fontSize: 13, color: "#6b7280", marginTop: 2 },
  avatarBtn:        { padding: 4 },
  banner:           { marginHorizontal: 20, marginBottom: 16, backgroundColor: "#fef3c7", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#fcd34d" },
  bannerTitle:      { fontWeight: "600", color: "#92400e", marginBottom: 4 },
  bannerBody:       { fontSize: 13, color: "#78350f", marginBottom: 12 },
  bannerButton:     { backgroundColor: "#d97706", borderRadius: 8, paddingVertical: 9, alignItems: "center" },
  bannerButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  balanceCard:      { marginHorizontal: 20, backgroundColor: "#16a34a", borderRadius: 16, padding: 24, marginBottom: 20 },
  balanceLabel:     { color: "rgba(255,255,255,0.8)", fontSize: 13, marginBottom: 8 },
  balanceAmount:    { color: "#fff", fontSize: 30, fontWeight: "700" },
  historyLink:      { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 12 },
  historyLinkText:  { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "500" },
  section:          { paddingHorizontal: 20, marginBottom: 20 },
  sectionRow:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle:     { fontSize: 15, fontWeight: "600", color: "#374151" },
  sectionLink:      { fontSize: 13, color: "#16a34a", fontWeight: "500" },
  quickActions:     { flexDirection: "row", gap: 10 },
  quickCard:        { flex: 1, backgroundColor: "#fff", borderRadius: 14, paddingVertical: 16, paddingHorizontal: 12, alignItems: "center", gap: 6, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  quickIconWrap:    { width: 44, height: 44, borderRadius: 12, backgroundColor: "#f0fdf4", justifyContent: "center", alignItems: "center" },
  quickCardText:    { fontWeight: "600", color: "#111827", fontSize: 13 },
  quickCardSub:     { fontSize: 10, color: "#9ca3af", textAlign: "center" },
  groupRow:         { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  groupAvatar:      { width: 40, height: 40, borderRadius: 10, backgroundColor: "#dcfce7", justifyContent: "center", alignItems: "center" },
  groupAvatarText:  { color: "#16a34a", fontWeight: "700", fontSize: 16 },
  groupName:        { fontWeight: "600", color: "#111827", fontSize: 15 },
  groupMeta:        { fontSize: 12, color: "#9ca3af", marginTop: 2 },
});
