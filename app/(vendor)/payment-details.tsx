import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { payoutMethodService, type PayoutMethodType } from "../../services/payoutMethodService";

const TYPES: { id: PayoutMethodType; label: string; icon: any }[] = [
  { id: "bank", label: "Bank Transfer", icon: "business-outline" },
  { id: "stripe", label: "Stripe", icon: "card-outline" },
  { id: "paypal", label: "PayPal", icon: "logo-paypal" },
];

export default function PaymentDetailsScreen() {
  const router = useRouter();

  const [type, setType] = useState<PayoutMethodType>("bank");
  const [accountHolder, setAccountHolder] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [country, setCountry] = useState("");
  const [email, setEmail] = useState("");
  const [makeDefault, setMakeDefault] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setError("");
    if (type === "bank") {
      if (!accountHolder.trim() || !bankName.trim() || !accountNumber.trim()) {
        setError("Please fill in account holder, bank name, and account number.");
        return;
      }
    } else {
      if (!email.trim()) {
        setError("Please enter the email associated with the account.");
        return;
      }
    }

    setSubmitting(true);
    try {
      await payoutMethodService.create({
        type,
        accountHolder: accountHolder.trim() || undefined,
        bankName: bankName.trim() || undefined,
        accountNumber: accountNumber.trim() || undefined,
        routingNumber: routingNumber.trim() || undefined,
        country: country.trim() || undefined,
        email: email.trim() || undefined,
        isDefault: makeDefault,
      });
      router.replace("/(vendor)/settings" as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save payout method.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace("/(vendor)/settings" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add payout method</Text>
        <Text style={styles.headerSubtitle}>This is where Eki will send your earnings.</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Method type</Text>
            <View style={styles.typeRow}>
              {TYPES.map((t) => {
                const selected = type === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => setType(t.id)}
                    activeOpacity={0.85}
                    style={[styles.typeChip, selected && styles.typeChipSelected]}
                  >
                    <Ionicons name={t.icon} size={18} color={selected ? "#FFFFFF" : "#076B51"} />
                    <Text style={[styles.typeChipText, selected && { color: "#FFFFFF" }]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{type === "bank" ? "Bank details" : "Account details"}</Text>

            {type === "bank" ? (
              <>
                <Field label="Account holder" value={accountHolder} onChange={setAccountHolder} placeholder="Full name on the account" />
                <Field label="Bank name" value={bankName} onChange={setBankName} placeholder="e.g. Barclays, Chase" />
                <Field label="Account number" value={accountNumber} onChange={setAccountNumber} placeholder="Account / IBAN" keyboardType="number-pad" />
                <Field label="Routing / Sort code" value={routingNumber} onChange={setRoutingNumber} placeholder="Optional" keyboardType="number-pad" />
                <Field label="Country" value={country} onChange={setCountry} placeholder="e.g. United Kingdom" />
              </>
            ) : (
              <Field
                label={type === "stripe" ? "Stripe account email" : "PayPal email"}
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
              />
            )}

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Set as default</Text>
              <Switch
                value={makeDefault}
                onValueChange={setMakeDefault}
                trackColor={{ false: "#D7E4DC", true: "#076B51" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            onPress={handleSave}
            activeOpacity={0.85}
            style={[styles.primaryButton, submitting && { opacity: 0.6 }]}
            disabled={submitting}
          >
            <Text style={styles.primaryButtonText}>{submitting ? "Saving..." : "Save Method"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "number-pad" | "email-address";
}
function Field({ label, value, onChange, placeholder, keyboardType }: FieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#858585"
          keyboardType={keyboardType ?? "default"}
          autoCapitalize={keyboardType === "email-address" ? "none" : "words"}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: { backgroundColor: "#076B51", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, gap: 6 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  headerTitle: { fontSize: 26, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 14, fontFamily: "Outfit-Light", color: "rgba(255,255,255,0.8)" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 18, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 14 },
  typeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  typeChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F4F4F4", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  typeChipSelected: { backgroundColor: "#076B51" },
  typeChipText: { fontSize: 13, fontFamily: "Outfit-Medium", color: "#076B51" },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontFamily: "Outfit-Medium", color: "#858585", marginBottom: 6 },
  inputWrap: { backgroundColor: "#F4F4F4", borderRadius: 10 },
  input: { height: 52, paddingHorizontal: 14, fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828" },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  toggleLabel: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#282828" },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", marginBottom: 12 },
  primaryButton: { height: 56, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  primaryButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
});
