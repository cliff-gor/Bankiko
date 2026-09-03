import { useEffect, useState } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Toast from "react-native-toast-message";
import { storage } from "@/lib/storage";
import { usePushToken } from "@/hooks/usePushToken";

export default function RootLayout() {
  const [checked, setChecked] = useState(false);
  usePushToken();

  useEffect(() => {
    storage.getAccessToken().then((token) => {
      if (!token) {
        router.replace("/(auth)/login");
      } else {
        router.replace("/(tabs)/");
      }
      setChecked(true);
    });
  }, []);

  if (!checked) return null;

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
      <Toast />
    </>
  );
}
