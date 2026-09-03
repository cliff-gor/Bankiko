import { useCallback, useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Toast from "react-native-toast-message";
import { storage } from "@/lib/storage";
import { usePushToken } from "@/hooks/usePushToken";
import { ServerUnavailableError } from "@/lib/api";
import { ServerWakingOverlay } from "@/components/ServerWakingOverlay";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "https://bankiko.onrender.com";

async function validateToken(token: string): Promise<"ok" | "expired" | "server_down"> {
  try {
    const res = await fetch(`${API_BASE}/actuator/health/liveness`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 502 || res.status === 503) return "server_down";
    if (res.status === 401) return "expired";
    return "ok";
  } catch {
    return "server_down";
  }
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [serverDown, setServerDown] = useState(false);
  usePushToken();

  const bootstrap = useCallback(async () => {
    setServerDown(false);
    const token = await storage.getAccessToken();

    if (!token) {
      router.replace("/(auth)/login");
      setReady(true);
      return;
    }

    const status = await validateToken(token);

    if (status === "server_down") {
      setServerDown(true);
      setReady(true);
      return;
    }

    if (status === "expired") {
      // Try refresh before giving up
      const refreshToken = await storage.getRefreshToken();
      if (!refreshToken) {
        await storage.clear();
        router.replace("/(auth)/login");
        setReady(true);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) throw new Error("Refresh failed");
        const data = await res.json();
        await storage.saveTokens(data.accessToken, data.refreshToken);
        router.replace("/(tabs)/");
      } catch {
        await storage.clear();
        router.replace("/(auth)/login");
      }
    } else {
      // Token valid
      router.replace("/(tabs)/");
    }

    setReady(true);
  }, []);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
      <Toast />
      {/* Loading overlay — shown until bootstrap completes so Stack is always mounted before navigation fires */}
      {!ready && (
        <View style={{ position: "absolute", inset: 0, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      )}
      {serverDown && <ServerWakingOverlay onRetry={bootstrap} />}
    </View>
  );
}
