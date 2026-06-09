import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useOnboardingStore } from "../../stores/onboardingStore";
import { useAuthStore } from "../../stores/authStore";
import { vendorService } from "../../services/vendorService";
import { COUNTRY_NAMES, getCitiesForCountry } from "../../utils/countries";
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
  const [country, setCountry] = useState<string>(vendorUser?.country || "Nigeria");
  const [city, setCity] = useState<string>(vendorUser?.city || "Lagos");
  const [description, setDescription] = useState(storeDetails.description || vendorUser?.storeDescription || "");
  const [submitting, setSubmitting] = useState(false);

  const cityOptions = useMemo(() => getCitiesForCountry(country), [country]);

  useEffect(() => {
    if (vendorUser?.storeName && !storeName) setStoreName(vendorUser.storeName);
    if (vendorUser?.storeDescription && !description) setDescription(vendorUser.storeDescription);
  }, [vendorUser?.storeName, vendorUser?.storeDescription, storeName, description]);

  // When country changes, ensure city stays consistent.
  useEffect(() => {
    if (cityOptions.length === 0) return;
    if (!cityOptions.includes(city)) {
      setCity(cityOptions[0]);
    }
  }, [country, cityOptions, city]);

  const handleContinue = async () => {
    if (!storeName.trim()) {
      Alert.alert("Missing details", "Store name is required.");
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
          country: country || undefined,
          city: city || undefined,
        });
        await checkAuth();
      } else {
        try {
          await vendorService.updateMyProfile({
            storeName: storeName.trim(),
            description: description.trim() || undefined,
            country: country || undefined,
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
            country: country || undefined,
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

            <View style={styles.row}>
              <View style={styles.halfField}>
                <FieldLabel>Country:</FieldLabel>
                <SelectBox
                  value={country}
                  options={COUNTRY_NAMES}
                  onChange={setCountry}
                  title="Select country"
                  placeholder="Select country"
                />
              </View>
              <View style={styles.halfField}>
                <FieldLabel>City:</FieldLabel>
                <SelectBox
                  value={city}
                  options={cityOptions}
                  onChange={setCity}
                  title="Select city"
                  placeholder={cityOptions.length ? "Select city" : "-"}
                  disabled={cityOptions.length === 0}
                />
              </View>
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

