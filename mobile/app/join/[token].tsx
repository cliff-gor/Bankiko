import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Pressable, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { getInviteDetails, joinViaInvite } from "@/lib/api";

interface InviteDetails {
  groupId: string;
  groupName: string;
  groupType: "SACCO" | "CHAMA";
  expiresAt: string;
}

export default function JoinScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { accessToken, isAuthenticated } = useAuth();

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getInviteDetails(token)
      .then(setInvite)
      .catch((e) => setError(e?.message ?? "Invalid or expired invite"))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleJoin() {
    if (!accessToken || !token) return;
    setJoining(true);
    try {
      await joinViaInvite(accessToken, token);
      Alert.alert("Joined!", `You are now a member of ${invite?.groupName}.`, [
        { text: "View Groups", onPress: () => router.replace("/(tabs)/groups") },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not join group");
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  if (error || !invite) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>❌</Text>
        <Text style={styles.title}>Invite not found</Text>
        <Text style={styles.subtitle}>{error ?? "This link may have expired."}</Text>
        <Pressable style={styles.btn} onPress={() => router.replace("/(tabs)")}>
          <Text style={styles.btnText}>Go to Dashboard</Text>
        </Pressable>
      </View>
    );
  }

  const isSacco = invite.groupType === "SACCO";

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={[styles.badge, isSacco ? styles.badgeSacco : styles.badgeChama]}>
          <Text style={[styles.badgeText, isSacco ? styles.badgeTextSacco : styles.badgeTextChama]}>
            {invite.groupType}
          </Text>
        </View>

        <Text style={styles.emoji}>{isSacco ? "🏦" : "🤝"}</Text>
        <Text style={styles.title}>{invite.groupName}</Text>
        <Text style={styles.subtitle}>
          You've been invited to join this {isSacco ? "SACCO" : "Chama"}.
        </Text>

        {!isAuthenticated ? (
          <>
            <Pressable
              style={styles.btn}
              onPress={() => router.push({ pathname: "/(auth)/login", params: { redirect: `/join/${token}` } })}
            >
              <Text style={styles.btnText}>Sign in to join</Text>
            </Pressable>
            <Pressable
              style={styles.btnOutline}
              onPress={() => router.push({ pathname: "/(auth)/register", params: { redirect: `/join/${token}` } })}
            >
              <Text style={styles.btnOutlineText}>Create account</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={[styles.btn, joining && styles.btnDisabled]} onPress={handleJoin} disabled={joining}>
            <Text style={styles.btnText}>{joining ? "Joining…" : `Join ${invite.groupName}`}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f4f5", justifyContent: "center", padding: 20 },
  center:    { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    gap: 12,
  },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  badgeSacco: { backgroundColor: "#ede9fe" },
  badgeChama: { backgroundColor: "#fef3c7" },
  badgeText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  badgeTextSacco: { color: "#7c3aed" },
  badgeTextChama: { color: "#b45309" },
  emoji:    { fontSize: 48, marginVertical: 4 },
  title:    { fontSize: 22, fontWeight: "700", textAlign: "center", color: "#111" },
  subtitle: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20 },
  errorIcon:{ fontSize: 40, marginBottom: 8 },
  btn: {
    backgroundColor: "#16a34a",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: "100%",
    alignItems: "center",
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  btnOutline: {
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 32,
    width: "100%",
    alignItems: "center",
  },
  btnOutlineText: { color: "#374151", fontWeight: "600", fontSize: 15 },
});
