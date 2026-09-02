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
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Contacts from "expo-contacts/legacy";
import Toast from "react-native-toast-message";
import { groupApi, walletApi, GroupResponse } from "@/lib/api";
import { storage } from "@/lib/storage";

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [group, setGroup] = useState<GroupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [contributeModal, setContributeModal] = useState(false);
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteQuery, setInviteQuery] = useState("");
  const [foundUser, setFoundUser] = useState<{ id: string; fullName: string; phone: string; email: string } | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const g = await groupApi.get(id);
      setGroup(g);
    } catch {
      Toast.show({ type: "error", text1: "Failed to load group" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Pre-fill phone from storage
  useEffect(() => {
    storage.getUser<{ phone?: string }>().then((u) => {
      if (u?.phone) setPhone(u.phone);
    });
  }, []);

  async function handlePickContact() {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== "granted") {
      Toast.show({ type: "error", text1: "Contacts permission denied" });
      return;
    }
    try {
      const contact = await Contacts.presentContactPickerAsync();
      if (!contact) return;
      const phone = contact.phoneNumbers?.[0]?.number?.replace(/[\s-]/g, "");
      const email = contact.emails?.[0]?.email;
      setInviteQuery(phone ?? email ?? "");
    } catch {
      Toast.show({ type: "error", text1: "Could not open contacts" });
    }
  }

  async function handleLookup() {
    if (!inviteQuery.trim()) return;
    setLookingUp(true);
    setFoundUser(null);
    try {
      const user = await groupApi.lookupUser(inviteQuery.trim());
      setFoundUser(user);
    } catch {
      Toast.show({ type: "error", text1: "User not found", text2: "Check the phone or email and try again" });
    } finally {
      setLookingUp(false);
    }
  }

  async function handleInvite() {
    if (!foundUser) return;
    setInviting(true);
    try {
      await groupApi.addMember(id, foundUser.id);
      Toast.show({ type: "success", text1: `${foundUser.fullName} added to group` });
      setInviteModal(false);
      setInviteQuery("");
      setFoundUser(null);
      load();
    } catch (err: any) {
      Toast.show({ type: "error", text1: err?.detail ?? "Failed to add member" });
    } finally {
      setInviting(false);
    }
  }

  async function handleContribute() {
    if (!amount || !phone) {
      Toast.show({ type: "error", text1: "Enter amount and phone number" });
      return;
    }
    setSubmitting(true);
    try {
      await walletApi.deposit(parseFloat(amount), phone);
      Toast.show({ type: "success", text1: "STK Push sent — check your phone" });
      setContributeModal(false);
      setAmount("");
    } catch (err: any) {
      Toast.show({ type: "error", text1: err?.detail ?? "Contribution failed" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  if (!group) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Group not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#16a34a" />}
      >
        {/* Header card */}
        <View style={styles.heroCard}>
          <View style={styles.heroAvatar}>
            <Text style={styles.heroAvatarText}>{group.name[0].toUpperCase()}</Text>
          </View>
          <Text style={styles.heroName}>{group.name}</Text>
          {group.description ? <Text style={styles.heroDesc}>{group.description}</Text> : null}
          <View style={styles.heroMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={16} color="rgba(255,255,255,0.8)" />
              <Text style={styles.metaText}>{group.memberCount} members</Text>
            </View>
            {group.monthlyContributionTarget > 0 && (
              <View style={styles.metaItem}>
                <Ionicons name="calendar-outline" size={16} color="rgba(255,255,255,0.8)" />
                <Text style={styles.metaText}>
                  KES {group.monthlyContributionTarget.toLocaleString("en-KE")} / month
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.section}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity style={[styles.contributeBtn, { flex: 1 }]} onPress={() => setContributeModal(true)}>
              <Ionicons name="arrow-down-circle-outline" size={20} color="#fff" />
              <Text style={styles.contributeBtnText}>Contribute</Text>
            </TouchableOpacity>
            {group.role === "ADMIN" && (
              <TouchableOpacity style={[styles.contributeBtn, { flex: 1, backgroundColor: "#1d4ed8" }]} onPress={() => setInviteModal(true)}>
                <Ionicons name="person-add-outline" size={20} color="#fff" />
                <Text style={styles.contributeBtnText}>Invite</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Info rows */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group details</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="people-circle-outline" label="Members" value={String(group.memberCount)} />
            <InfoRow icon="shield-checkmark-outline" label="Your role" value={group.role ?? "MEMBER"} />
            {group.contributionDueDay > 0 && (
              <InfoRow icon="calendar-number-outline" label="Contribution due" value={`Day ${group.contributionDueDay} of each month`} />
            )}
            <InfoRow icon="stats-chart-outline" label="Status" value={group.status ?? "ACTIVE"} last />
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Invite modal */}
      <Modal visible={inviteModal} animationType="slide" transparent onRequestClose={() => setInviteModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Invite to {group.name}</Text>
            <Text style={styles.label}>Phone number or email</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="0712345678 or user@email.com"
                value={inviteQuery}
                onChangeText={setInviteQuery}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TouchableOpacity
                style={[styles.submitBtn, { flex: 0, paddingHorizontal: 16, marginBottom: 0 }]}
                onPress={handleLookup}
                disabled={lookingUp}
              >
                {lookingUp ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Find</Text>}
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14, alignSelf: "flex-start" }}
              onPress={handlePickContact}
            >
              <Ionicons name="people-circle-outline" size={18} color="#1d4ed8" />
              <Text style={{ fontSize: 13, color: "#1d4ed8", fontWeight: "500" }}>Pick from contacts</Text>
            </TouchableOpacity>
            {foundUser && (
              <View style={{ backgroundColor: "#f0fdf4", borderRadius: 10, padding: 14, marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#16a34a", justifyContent: "center", alignItems: "center" }}>
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>{foundUser.fullName[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "600", color: "#111827" }}>{foundUser.fullName}</Text>
                  <Text style={{ fontSize: 12, color: "#6b7280" }}>{foundUser.phone}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.submitBtn, { flex: 0, paddingHorizontal: 16, paddingVertical: 10 }]}
                  onPress={handleInvite}
                  disabled={inviting}
                >
                  {inviting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Add</Text>}
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setInviteModal(false); setInviteQuery(""); setFoundUser(null); }}>
              <Text style={styles.cancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Contribute modal */}
      <Modal visible={contributeModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Contribute to {group.name}</Text>

            <Text style={styles.label}>Amount (KES)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder={group.monthlyContributionTarget > 0 ? String(group.monthlyContributionTarget) : "500"}
              value={amount}
              onChangeText={setAmount}
            />

            <Text style={styles.label}>M-Pesa Phone</Text>
            <TextInput
              style={styles.input}
              keyboardType="phone-pad"
              placeholder="0712345678"
              value={phone}
              onChangeText={setPhone}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setContributeModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleContribute}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Send STK Push</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function InfoRow({ icon, label, value, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; last?: boolean }) {
  return (
    <View style={[infoStyles.row, !last && infoStyles.rowBorder]}>
      <Ionicons name={icon} size={18} color="#9ca3af" />
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row:       { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  label:     { flex: 1, fontSize: 14, color: "#6b7280" },
  value:     { fontSize: 14, fontWeight: "600", color: "#111827" },
});

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: "#f9fafb" },
  center:            { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  errorText:         { fontSize: 16, color: "#6b7280" },
  backBtn:           { backgroundColor: "#16a34a", borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  backBtnText:       { color: "#fff", fontWeight: "600" },
  heroCard:          { margin: 20, backgroundColor: "#16a34a", borderRadius: 20, padding: 24, alignItems: "center", gap: 8 },
  heroAvatar:        { width: 64, height: 64, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  heroAvatarText:    { color: "#fff", fontSize: 28, fontWeight: "800" },
  heroName:          { color: "#fff", fontSize: 22, fontWeight: "700", textAlign: "center" },
  heroDesc:          { color: "rgba(255,255,255,0.75)", fontSize: 13, textAlign: "center" },
  heroMeta:          { flexDirection: "row", gap: 16, marginTop: 8, flexWrap: "wrap", justifyContent: "center" },
  metaItem:          { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText:          { color: "rgba(255,255,255,0.85)", fontSize: 13 },
  section:           { paddingHorizontal: 20, marginBottom: 16 },
  sectionTitle:      { fontSize: 15, fontWeight: "600", color: "#374151", marginBottom: 10 },
  contributeBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#16a34a", borderRadius: 14, paddingVertical: 16 },
  contributeBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  infoCard:          { backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 16, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  overlay:           { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modal:             { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle:        { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 20 },
  label:             { fontSize: 14, fontWeight: "500", color: "#374151", marginBottom: 6 },
  input:             { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: "#111827", marginBottom: 14 },
  modalActions:      { flexDirection: "row", gap: 12, marginTop: 4 },
  cancelBtn:         { flex: 1, borderWidth: 1.5, borderColor: "#d1d5db", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  cancelBtnText:     { fontWeight: "600", color: "#374151" },
  submitBtn:         { flex: 1, backgroundColor: "#16a34a", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText:     { color: "#fff", fontWeight: "600", fontSize: 15 },
});
