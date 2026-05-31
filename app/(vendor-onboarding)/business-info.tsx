import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useOnboardingStore } from "../../stores/onboardingStore";
import { useAuthStore } from "../../stores/authStore";
import { vendorService } from "../../services/vendorService";
import {
  FieldLabel,
  FormCard,
  OnboardingHeader,
  OptionRow,
  PrimaryButton,
} from "../../components/onboarding/FigmaNativeUI";

type Region = "africa" | "abroad";
type SellerType = "individual" | "business";

export default function BusinessInfoScreen() {
  const router = useRouter();
  const { updateBusinessInfo } = useOnboardingStore();
  const { user, setUser } = useAuthStore();
  const vendor = user?.role === "vendor" ? user : null;

  const [region, setRegion] = useState<Region>(vendor?.sellerRegion ?? "africa");
  const [sellerType, setSellerType] = useState<SellerType | null>(
    vendor?.businessType === "registered"
      ? "business"
      : vendor?.businessType === "individual"
        ? "individual"
        : null
  );
  const [submitting, setSubmitting] = useState(false);

  const handleContinue = async () => {
    if (!sellerType) {
      Alert.alert("Select seller type", "Choose whether you sell as an individual vendor or a store.");
      return;
    }

    setSubmitting(true);
    const businessType = sellerType === "individual" ? "individual" : "registered";

    updateBusinessInfo({
      type: businessType,
      category: region === "africa" ? "Africa-based" : "Abroad-based",
    });

    try {
      const updatedVendor = await vendorService.updateMyProfile({
        businessType,
        sellerRegion: region,
      });
      if (user?.role === "vendor") {
        setUser({
          ...user,
          businessType: updatedVendor.businessType ?? businessType,
          sellerRegion: updatedVendor.sellerRegion ?? region,
        });
      }
      router.push("/(vendor-onboarding)/add-product" as any);
    } catch (err) {
      Alert.alert(
        "Could not save business info",
        err instanceof Error ? err.message : "Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <OnboardingHeader
        activeSegments={2}
        subtitle="This helps us set up your store properly"
        title={"Tell us about your\nbusiness"}
      />

      <FormCard>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Business Type</Text>

          <View style={styles.group}>
            <FieldLabel>Select Region</FieldLabel>
            <View style={styles.optionStack}>
              <OptionRow
                label="I sell from Africa"
                onPress={() => setRegion("africa")}
                selected={region === "africa"}
              />
              <OptionRow
                label="I sell from abroad"
                onPress={() => setRegion("abroad")}
                selected={region === "abroad"}
              />
            </View>
          </View>

          <View style={styles.group}>
            <FieldLabel>Seller Type</FieldLabel>
            <View style={styles.optionStack}>
              <OptionRow
                label="I sell as an individual vendor"
                onPress={() => setSellerType("individual")}
                selected={sellerType === "individual"}
              />
              <OptionRow
                label="I sell as a store or business"
                onPress={() => setSellerType("business")}
                selected={sellerType === "business"}
              />
            </View>
          </View>

          <View style={{ flex: 1, minHeight: 24 }} />
          <PrimaryButton
            disabled={submitting}
            onPress={handleContinue}
            title={submitting ? "Saving..." : "Continue"}
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
    marginBottom: 22,
  },
  group: { marginBottom: 22 },
  optionStack: { gap: 12, marginTop: 4 },
});
