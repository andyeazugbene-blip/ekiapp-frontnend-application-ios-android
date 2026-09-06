import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useOnboardingStore } from "../../stores/onboardingStore";
import { useAuthStore } from "../../stores/authStore";
import { vendorService } from "../../services/vendorService";
import { COUNTRIES, getCitiesForCountry } from "../../utils/countries";
import {
  FieldLabel,
  FormCard,
  OnboardingHeader,
  PrimaryButton,
  SelectBox,
} from "../../components/onboarding/FigmaNativeUI";

export default function SetupStoreScreen() {
  const router = useRouter();
  const { storeDetails, updateStoreDetails } = useOnboardingStore();
  const { user, checkAuth } = useAuthStore();
  const isVendor = user?.role === "vendor";
  const vendorUser = isVendor ? (user as any) : null;

  const [storeName, setStoreName] = useState(storeDetails.storeName || vendorUser?.storeName || "");
  // No default market — Eki has no product rule requiring one, and a silent
  // default (this used to be "Nigeria"/"Lagos") let a vendor complete
  // onboarding without ever consciously picking a market, in a country that
  // was never actually approved for launch. Require explicit selection
  // instead (enforced below in handleContinue). A vendor may now serve more
  // than one approved market — the first one picked (in the list's order)
  // becomes their primary market/currency.
  const [markets, setMarkets] = useState<string[]>(vendorUser?.country ? [vendorUser.country] : []);
  const [city, setCity] = useState<string>(vendorUser?.city || "");
  const [description, setDescription] = useState(storeDetails.description || vendorUser?.storeDescription || "");
  const [submitting, setSubmitting] = useState(false);

  // markets[0] is whichever market was picked first — that's the primary
  // market/currency, matching exactly what the backend does with the same
  // array (see vendorsService.createVendor).
  const primaryCountry = markets[0] ?? "";
  const cityOptions = useMemo(() => getCitiesForCountry(primaryCountry), [primaryCountry]);

  const toggleMarket = (name: string) => {
    setMarkets((current) => (current.includes(name) ? current.filter((m) => m !== name) : [...current, name]));
  };

  useEffect(() => {
    if (vendorUser?.storeName && !storeName) setStoreName(vendorUser.storeName);
    if (vendorUser?.storeDescription && !description) setDescription(vendorUser.storeDescription);
  }, [vendorUser?.storeName, vendorUser?.storeDescription, storeName, description]);

  // When the primary market changes, ensure city stays consistent.
  useEffect(() => {
    if (cityOptions.length === 0) return;
    if (!cityOptions.includes(city)) {
      setCity(cityOptions[0]);
    }
  }, [primaryCountry, cityOptions, city]);

  const handleContinue = async () => {
    if (!storeName.trim()) {
      Alert.alert("Missing details", "Store name is required.");
      return;
    }
    if (markets.length === 0) {
      Alert.alert("Missing details", "Please select at least one market you serve.");
      return;
    }

    setSubmitting(true);
    updateStoreDetails({ storeName: storeName.trim(), description: description.trim() });

    try {
      const shouldCreateProfile =
        !isVendor ||
        !vendorUser?.storeName ||
        !vendorUser?.storeSlug;

      if (shouldCreateProfile) {
        await vendorService.createVendorProfile({
          storeName: storeName.trim(),
          description: description.trim() || undefined,
          markets,
          city: city || undefined,
        });
        await checkAuth();
      } else {
        try {
          // Editing an existing vendor's PRIMARY market here (secondary
          // markets are managed on the dedicated "Markets you serve" screen
          // in the vendor profile, via /vendors/me/markets) — country stays
          // a single value for this update path, matching the backend's
          // PATCH /vendors/me contract.
          await vendorService.updateMyProfile({
            storeName: storeName.trim(),
            description: description.trim() || undefined,
            country: primaryCountry || undefined,
            city: city || undefined,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message.toLowerCase() : "";
          if (!message.includes("vendor profile")) {
            throw err;
          }

          await vendorService.createVendorProfile({
            storeName: storeName.trim(),
            description: description.trim() || undefined,
            markets,
            city: city || undefined,
          });
          await checkAuth();
        }
      }
      router.push("/(vendor-onboarding)/business-info" as any);
    } catch (err) {
      Alert.alert(
        "Could not save store",
        err instanceof Error ? err.message : "Could not save store details. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <OnboardingHeader
          activeSegments={1}
          subtitle="This is how buyers will identify your store"
          title="Set up your store"
        />

        <FormCard>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollBody}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionTitle}>Store Setup</Text>
            <Text style={styles.sectionSubtitle}>This is how buyers will identify your store</Text>

            <View style={styles.fieldGroup}>
              <FieldLabel>Store name</FieldLabel>
              <TextInput
                onChangeText={setStoreName}
                placeholder="e.g. Mama's kitchen"
                placeholderTextColor="#858585"
                style={styles.input}
                value={storeName}
              />
            </View>

            <View style={styles.fieldGroup}>
              <FieldLabel>Markets you serve:</FieldLabel>
              <Text style={styles.marketsHint}>
                Select every approved market you sell in. The first one you pick is your primary market and currency.
              </Text>
              <View style={styles.marketsGrid}>
                {COUNTRIES.map((c) => {
                  const selected = markets.includes(c.name);
                  return (
                    <TouchableOpacity
                      key={c.code}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      activeOpacity={0.78}
                      onPress={() => toggleMarket(c.name)}
                      style={[styles.marketChip, selected && styles.marketChipSelected]}
                    >
                      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                        {selected ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                      </View>
                      <Text style={[styles.marketChipText, selected && styles.marketChipTextSelected]}>{c.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <FieldLabel>City:</FieldLabel>
              <SelectBox
                value={city}
                options={cityOptions}
                onChange={setCity}
                title="Select city"
                placeholder={cityOptions.length ? "Select city" : "Pick a market first"}
                disabled={cityOptions.length === 0}
              />
            </View>

            <View style={styles.fieldGroup}>
              <FieldLabel>Store Description</FieldLabel>
              <TextInput
                multiline
                onChangeText={setDescription}
                placeholder="Tell buyers what you sell.."
                placeholderTextColor="#858585"
                style={styles.description}
                textAlignVertical="top"
                value={description}
              />
            </View>

            <View style={{ flex: 1, minHeight: 20 }} />
            <PrimaryButton
              disabled={submitting}
              onPress={handleContinue}
              title={submitting ? "Saving..." : "Continue"}
            />
            <View style={{ height: 12 }} />
          </ScrollView>
        </FormCard>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#076B51" },
  flex: { flex: 1 },
  scrollBody: { flexGrow: 1, paddingBottom: 16 },
  sectionTitle: { color: "#1A1A1A", fontFamily: "Manrope-Bold", fontSize: 18 },
  sectionSubtitle: {
    color: "#858585",
    fontFamily: "Outfit-Regular",
    fontSize: 13,
    marginTop: 6,
    marginBottom: 22,
  },
  fieldGroup: { marginBottom: 16 },
  input: {
    height: 50,
    borderRadius: 12,
    backgroundColor: "#F4F4F4",
    color: "#282828",
    fontFamily: "Outfit-Regular",
    fontSize: 14,
    paddingHorizontal: 18,
  },
  row: { flexDirection: "row", gap: 12, marginBottom: 16 },
  halfField: { flex: 1 },
  marketsHint: {
    color: "#858585",
    fontFamily: "Outfit-Regular",
    fontSize: 12,
    marginTop: 4,
    marginBottom: 10,
  },
  marketsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  marketChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#F4F4F4",
    borderWidth: 1,
    borderColor: "#F4F4F4",
  },
  marketChipSelected: {
    backgroundColor: "rgba(7,107,81,0.08)",
    borderColor: "#076B51",
  },
  marketChipText: {
    color: "#858585",
    fontFamily: "Outfit-Regular",
    fontSize: 13,
  },
  marketChipTextSelected: {
    color: "#076B51",
    fontFamily: "Outfit-SemiBold",
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#B8B8B8",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: "#076B51",
    borderColor: "#076B51",
  },
  description: {
    minHeight: 160,
    borderRadius: 12,
    backgroundColor: "#F4F4F4",
    color: "#282828",
    fontFamily: "Outfit-Regular",
    fontSize: 14,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
});

