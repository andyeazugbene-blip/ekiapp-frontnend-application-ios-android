import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useOnboardingStore, type DeliveryCountry } from "../../stores/onboardingStore";
import {
  FormCard,
  OnboardingHeader,
  PrimaryButton,
} from "../../components/onboarding/FigmaNativeUI";

const COUNTRIES: { label: string; value: DeliveryCountry }[] = [
  { label: "United Kingdom", value: "UK" },
  { label: "United States", value: "US" },
  { label: "Canada", value: "Canada" },
  { label: "Europe", value: "Europe" },
];

export default function DeliveryCountriesScreen() {
  const router = useRouter();
  const { selectedCountries, toggleCountry, getNextDeliveryRoute } = useOnboardingStore();
  const [submitting, setSubmitting] = useState(false);

  const handleContinue = () => {
    if (selectedCountries.length === 0) {
      Alert.alert("Select at least one country", "Choose at least one country to continue.");
      return;
    }
    setSubmitting(true);
    router.push(getNextDeliveryRoute(null) as any);
    setSubmitting(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <OnboardingHeader
        activeSegments={5}
        subtitle={"Choose at least one country to start\nreceiving orders"}
        title={"Where do you want\nto sell?"}
      />

      <FormCard>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Business Type</Text>

          <View style={styles.optionsList}>
            {COUNTRIES.map((country) => {
              const isSelected = selectedCountries.includes(country.value);
              return (
                <TouchableOpacity
                  key={country.label}
                  onPress={() => toggleCountry(country.value)}
                  activeOpacity={0.85}
                  style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                >
                  <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                    {isSelected ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                  </View>
                  <Text style={[styles.optionText, isSelected ? styles.optionTextActive : styles.optionTextMuted]}>
                    {country.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ flex: 1, minHeight: 80 }} />

          <PrimaryButton
            onPress={handleContinue}
            title={submitting ? "..." : "Continue"}
            disabled={submitting}
          />
          <View style={{ height: 12 }} />
        </ScrollView>
      </FormCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#076B51" },
  scrollBody: { flexGrow: 1, paddingBottom: 16 },
  sectionTitle: {
    color: "#1A1A1A",
    fontFamily: "Manrope-Bold",
    fontSize: 18,
    marginBottom: 18,
  },
  optionsList: { gap: 10 },
  optionRow: {
    minHeight: 54,
    backgroundColor: "#F4F4F4",
    borderRadius: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  optionRowSelected: {
    borderColor: "#076B51",
    backgroundColor: "rgba(7,107,81,0.04)",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.8,
    borderColor: "#C5C5C5",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: "#076B51",
    borderColor: "#076B51",
  },
  optionText: { fontSize: 14, fontFamily: "Manrope-SemiBold" },
  optionTextActive: { color: "#1A1A1A" },
  optionTextMuted: { color: "#858585" },
});
