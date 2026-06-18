import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
} from "react-native";
import Toast from "react-native-toast-message";
import { groupApi, GroupResponse } from "@/lib/api";

export default function GroupsScreen() {
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setGroups(await groupApi.list());
    } catch {
      Toast.show({ type: "error", text1: "Failed to load groups" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!name.trim()) {
      Toast.show({ type: "error", text1: "Group name is required" });
      return;
    }
    setCreating(true);
    try {
      await groupApi.create(name.trim(), description.trim());
      Toast.show({ type: "success", text1: "Group created!" });
      setModalVisible(false);
      setName("");
      setDescription("");
      load();
    } catch (err: any) {
      Toast.show({ type: "error", text1: err?.detail ?? "Failed to create group" });
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#16a34a" />}
      >
        <View style={styles.header}>
          <Text style={styles.heading}>My groups</Text>
          <TouchableOpacity style={styles.createBtn} onPress={() => setModalVisible(true)}>
            <Text style={styles.createBtnText}>+ New group</Text>
          </TouchableOpacity>
        </View>

        {groups.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No groups yet</Text>
            <Text style={styles.emptyBody}>Create or join a group to start contributing and borrowing together.</Text>
          </View>
        ) : (
          groups.map((g) => (
            <View key={g.id} style={styles.card}>
              <View style={styles.cardAvatar}>
                <Text style={styles.cardAvatarText}>{g.name[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{g.name}</Text>
                {g.description ? <Text style={styles.cardDesc}>{g.description}</Text> : null}
                <View style={styles.cardMeta}>
                  <Text style={styles.metaChip}>{g.memberCount} members</Text>
                  <Text style={[styles.metaChip, g.role === "ADMIN" && styles.metaChipAdmin]}>{g.role}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Create a new group</Text>

            <Text style={styles.label}>Group name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Umoja Chama"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: "top" }]}
              placeholder="What is this group for?"
              multiline
              value={description}
              onChangeText={setDescription}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setModalVisible(false); setName(""); setDescription(""); }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, creating && styles.submitBtnDisabled]}
                onPress={handleCreate}
                disabled={creating}
              >
                {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20 },
  heading: { fontSize: 20, fontWeight: "700", color: "#111827" },
  createBtn: { backgroundColor: "#16a34a", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  createBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  empty: { alignItems: "center", marginTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: "#374151", marginBottom: 8 },
  emptyBody: { textAlign: "center", color: "#9ca3af", lineHeight: 20 },
  card: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginHorizontal: 20, marginBottom: 12, backgroundColor: "#fff", borderRadius: 14, padding: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardAvatar: { width: 44, height: 44, borderRadius: 11, backgroundColor: "#dcfce7", justifyContent: "center", alignItems: "center" },
  cardAvatarText: { color: "#16a34a", fontWeight: "700", fontSize: 18 },
  cardName: { fontWeight: "600", color: "#111827", fontSize: 16 },
  cardDesc: { fontSize: 13, color: "#6b7280", marginTop: 2, marginBottom: 6 },
  cardMeta: { flexDirection: "row", gap: 6, marginTop: 4 },
  metaChip: { backgroundColor: "#f3f4f6", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, fontSize: 11, color: "#6b7280", fontWeight: "500" },
  metaChipAdmin: { backgroundColor: "#dcfce7", color: "#16a34a" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modal: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "500", color: "#374151", marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: "#111827", marginBottom: 14 },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 4 },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderColor: "#d1d5db", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  cancelBtnText: { fontWeight: "600", color: "#374151" },
  submitBtn: { flex: 1, backgroundColor: "#16a34a", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
