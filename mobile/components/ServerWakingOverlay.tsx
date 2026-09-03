import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";

interface Props {
  onRetry: () => void;
}

export function ServerWakingOverlay({ onRetry }: Props) {
  const [countdown, setCountdown] = useState(15);

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          onRetry();
          return 15;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [onRetry]);

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color="#d97706" style={{ marginBottom: 16 }} />
        <Text style={styles.title}>Server is starting up</Text>
        <Text style={styles.sub}>
          The backend is waking from sleep. This takes about 30–60 seconds on first load.
        </Text>
        <Text style={styles.countdown}>
          Retrying in <Text style={styles.countNum}>{countdown}s</Text>
        </Text>
        <Pressable style={styles.btn} onPress={onRetry}>
          <Text style={styles.btnText}>Retry now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute", inset: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 99,
    padding: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  title: { fontSize: 18, fontWeight: "700", color: "#111", textAlign: "center" },
  sub:   { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20 },
  countdown: { fontSize: 13, color: "#9ca3af" },
  countNum:  { fontWeight: "700", color: "#374151" },
  btn: {
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 28,
  },
  btnText: { fontWeight: "600", color: "#374151", fontSize: 14 },
});
