import { Stack } from "expo-router";

export default function GroupsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#fff" },
        headerTintColor: "#111827",
        headerTitleStyle: { fontWeight: "600" },
        headerBackTitle: "Groups",
      }}
    >
      <Stack.Screen name="index" options={{ title: "My Groups" }} />
      <Stack.Screen name="[id]" options={{ title: "Group" }} />
    </Stack>
  );
}
