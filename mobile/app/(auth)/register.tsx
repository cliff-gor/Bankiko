import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Link, router } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Toast from "react-native-toast-message";
import { authApi } from "@/lib/api";
import { storage } from "@/lib/storage";

const schema = z.object({
  fullName: z.string().min(2, "Full name required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(10, "Enter a valid phone number"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type FormData = z.infer<typeof schema>;

export default function RegisterScreen() {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    try {
      const res = await authApi.register(data);
      await storage.saveTokens(res.accessToken, res.refreshToken);
      await storage.saveUser({ email: res.email, fullName: res.fullName, role: res.role });
      router.replace("/(tabs)/");
    } catch (err: any) {
      Toast.show({ type: "error", text1: err?.detail ?? "Registration failed" });
    }
  }

  const fields: { name: keyof FormData; label: string; placeholder: string; keyboard?: any; secure?: boolean }[] = [
    { name: "fullName", label: "Full name", placeholder: "Jane Doe" },
    { name: "email", label: "Email", placeholder: "you@example.com", keyboard: "email-address" },
    { name: "phone", label: "Phone number", placeholder: "0712345678", keyboard: "phone-pad" },
    { name: "password", label: "Password", placeholder: "••••••••", secure: true },
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>B</Text>
            </View>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Join Bankiko SACCO today</Text>
          </View>

          {fields.map(({ name, label, placeholder, keyboard, secure }) => (
            <Controller
              key={name}
              control={control}
              name={name}
              render={({ field: { onChange, value } }) => (
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>{label}</Text>
                  <TextInput
                    style={[styles.input, errors[name] && styles.inputError]}
                    placeholder={placeholder}
                    keyboardType={keyboard}
                    autoCapitalize="none"
                    secureTextEntry={secure}
                    value={value}
                    onChangeText={onChange}
                  />
                  {errors[name] && <Text style={styles.errorText}>{errors[name]?.message}</Text>}
                </View>
              )}
            />
          ))}

          <TouchableOpacity
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Create account</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.footerText}>
            Already have an account?{" "}
            <Link href="/(auth)/login" style={styles.link}>
              Sign in
            </Link>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0fdf4" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 20 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 24, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  header: { alignItems: "center", marginBottom: 24 },
  logo: { width: 56, height: 56, borderRadius: 14, backgroundColor: "#16a34a", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  logoText: { color: "#fff", fontSize: 24, fontWeight: "700" },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6b7280", marginTop: 4 },
  fieldGroup: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: "500", color: "#374151", marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: "#111827" },
  inputError: { borderColor: "#ef4444" },
  errorText: { color: "#ef4444", fontSize: 12, marginTop: 4 },
  button: { backgroundColor: "#16a34a", borderRadius: 10, paddingVertical: 13, alignItems: "center", marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  footerText: { textAlign: "center", marginTop: 16, fontSize: 14, color: "#6b7280" },
  link: { color: "#16a34a", fontWeight: "600" },
});
