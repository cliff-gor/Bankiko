import { useEffect } from "react";
import { Platform } from "react-native";
import { deviceTokenApi } from "@/lib/api";

/**
 * Registers the device FCM token with the Bankiko backend.
 *
 * Setup:
 *   npx expo install expo-notifications expo-device
 *   Add to app.json plugins: ["expo-notifications"]
 *
 * Call this hook once in your root layout after the user is authenticated.
 */
export function usePushToken() {
  useEffect(() => {
    registerPushToken();
  }, []);
}

async function registerPushToken() {
  try {
    // Dynamically import so the app doesn't crash if expo-notifications isn't installed yet
    const Notifications = await import("expo-notifications").catch(() => null);
    const Device = await import("expo-device").catch(() => null);

    if (!Notifications || !Device) return;
    if (!Device.default.isDevice) return; // push tokens only work on real devices

    const { status: existingStatus } = await Notifications.default.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.default.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") return;

    // On Android, a notification channel is required
    if (Platform.OS === "android") {
      await Notifications.default.setNotificationChannelAsync("default", {
        name: "Bankiko",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const tokenData = await Notifications.default.getExpoPushTokenAsync();
    const token = tokenData.data;

    await deviceTokenApi.register(token, "FCM");
  } catch (e) {
    // Non-fatal — SMS notifications still work
    console.log("[push] token registration skipped:", e);
  }
}
