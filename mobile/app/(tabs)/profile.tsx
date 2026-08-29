import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { storage } from "@/lib/storage";

interface StoredUser {
  fullName?: string;
  email?: string;
  phone?: string;
  role?: string;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    storage.getUser<StoredUser>().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  function handleLogout() {
    Alert.alert(
      "Sign out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            await storage.clear();
            router.replace("/(auth)/login");
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  const initials = user?.fullName
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() ?? "?";

  return (
    <ScrollView style={styles.container}>
      {/* Profile hero */}
      <View style={[styles.hero, { paddingTop: insets.top + 24 }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{user?.fullName ?? "—"}</Text>
        <Text style={styles.email}>{user?.email ?? "—"}</Text>
        {user?.role && (
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user.role.replace("_", " ")}</Text>
          </View>
        )}
      </View>

      {/* Info section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account details</Text>
        <View style={styles.infoCard}>
          <InfoRow icon="call-outline"   label="Phone"  value={user?.phone ?? "Not set"} />
          <InfoRow icon="mail-outline"   label="Email"  value={user?.email ?? "Not set"} />
          <InfoRow icon="shield-outline" label="Role"   value={user?.role?.replace("_", " ") ?? "MEMBER"} last />
        </View>
      </View>

      {/* Divider */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.infoCard}>
          <TouchableOpacity style={[styles.actionRow, styles.rowBorder]}>
            <Ionicons name="notifications-outline" size={20} color="#6b7280" />
            <Text style={styles.actionLabel}>Notifications</Text>
            <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionRow, styles.rowBorder]}>
            <Ionicons name="lock-closed-outline" size={20} color="#6b7280" />
            <Text style={styles.actionLabel}>Change password</Text>
            <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionRow} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            <Text style={[styles.actionLabel, { color: "#ef4444" }]}>Sign out</Text>
            <Ionicons name="chevron-forward" size={16} color="#fca5a5" />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.version}>Bankiko v1.0 · SACCO Platform</Text>
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function InfoRow({ icon, label, value, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; last?: boolean }) {
  return (
    <View style={[rowStyles.row, !last && rowStyles.border]}>
      <Ionicons name={icon} size={18} color="#9ca3af" />
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row:    { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13 },
  border: { borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  label:  { flex: 1, fontSize: 14, color: "#6b7280" },
  value:  { fontSize: 14, fontWeight: "500", color: "#111827", maxWidth: "55%" },
});

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#f9fafb" },
  center:       { flex: 1, justifyContent: "center", alignItems: "center" },
  hero:         { backgroundColor: "#fff", alignItems: "center", paddingBottom: 28, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  avatar:       { width: 80, height: 80, borderRadius: 20, backgroundColor: "#16a34a", justifyContent: "center", alignItems: "center", marginBottom: 14 },
  avatarText:   { color: "#fff", fontSize: 30, fontWeight: "800" },
  name:         { fontSize: 22, fontWeight: "700", color: "#111827" },
  email:        { fontSize: 14, color: "#6b7280", marginTop: 4 },
  roleBadge:    { marginTop: 10, backgroundColor: "#f0fdf4", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4 },
  roleText:     { fontSize: 12, fontWeight: "600", color: "#16a34a" },
  section:      { paddingHorizontal: 20, marginTop: 24 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  infoCard:     { backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 16, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  actionRow:    { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  rowBorder:    { borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  actionLabel:  { flex: 1, fontSize: 15, color: "#374151", fontWeight: "500" },
  version:      { textAlign: "center", color: "#d1d5db", fontSize: 12, marginTop: 32 },
});
