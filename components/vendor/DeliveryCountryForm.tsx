/**
 * Shared form for the four onboarding delivery-country screens
 * (UK / US / Canada / Europe). Pixel-matched to the provided screenshots.
 *
 * Captures the same fields, posts to `POST /api/vendors/me/delivery-zones`,
 * and routes to the next selected country (or to the summary).
 */
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  deliveryService,
  COUNTRY_CURRENCY,
  type DeliveryCountryCode,
} from "../../services/deliveryService";
import {
  useOnboardingStore,
  type DeliveryCountry,
} from "../../stores/onboardingStore";
import {
  FieldLabel,
  FormCard,
  OnboardingHeader,
  OutlineButton,
  PrimaryButton,
  SelectBox,
} from "../onboarding/FigmaNativeUI";

interface Props {
  countryCode: DeliveryCountryCode;
  countryLabel: string;
  currencySymbol: string;
  title: string;
  saveLabel: string;
  /** The label used by `useOnboardingStore.getNextDeliveryRoute(...)` */
  afterCountry: DeliveryCountry;
  onSaved: (nextRoute: string) => void;
  onBack: () => void;
}

const COST_PER_KG_OPTIONS = ["2", "3", "4", "5", "6", "7", "8", "10", "12", "15"];
const MAX_WEIGHT_OPTIONS = ["5", "10", "15", "20", "25", "30"];
const DELIVERY_TIME_OPTIONS = ["1–2 days", "2–3 days", "3–5 days", "5–7 days", "7–10 days", "10–14 days"];

export default function DeliveryCountryForm({
  countryCode,
  countryLabel,
  currencySymbol,
  title,
  saveLabel,
  afterCountry,
  onSaved,
  onBack,
}: Props) {
  const { getNextDeliveryRoute } = useOnboardingStore();

  const [costPerKg, setCostPerKg] = useState("");
  const [minFee, setMinFee] = useState("");
  const [maxWeight, setMaxWeight] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("3–5 days");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    setError("");
    const parsedCostPerKg = Number(costPerKg.replace(/[^\d.]/g, ""));
    const parsedMinFee = Number(minFee.replace(/[^\d.]/g, ""));
    const parsedMaxWeight = Number(maxWeight.replace(/[^\d.]/g, ""));

    if (!Number.isFinite(parsedCostPerKg) || parsedCostPerKg <= 0) {
      setError("Please select a delivery cost per kg.");
      return;
    }
    if (!Number.isFinite(parsedMinFee) || parsedMinFee < 0) {
      setError("Please enter a minimum delivery fee.");
      return;
    }
    if (!Number.isFinite(parsedMaxWeight) || parsedMaxWeight <= 0) {
      setError("Please select the max order weight.");
      return;
    }

    setSubmitting(true);
    try {
      await deliveryService.createZone({
        country: countryLabel,
        countryCode,
        currency: COUNTRY_CURRENCY[countryCode],
        costPerKg: parsedCostPerKg,
        minimumFee: parsedMinFee,
        maxWeightKg: parsedMaxWeight,
        estimatedDays: deliveryTime,
        notes: notes.trim() || undefined,
        active: true,
      });
      onSaved(getNextDeliveryRoute(afterCountry));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save delivery zone. Please try again.");
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
          activeSegments={6}
          subtitle={"Buyer delivery cost will be calculated from\norder weight"}
          title={title}
        />

        <FormCard>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollBody}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionTitle}>Delivery Setup</Text>

            <View style={styles.fieldGroup}>
              <FieldLabel>Delivery cost per kg</FieldLabel>
              <SelectBox
                value={costPerKg ? `${currencySymbol}${costPerKg}` : ""}
                options={COST_PER_KG_OPTIONS.map((v) => `${currencySymbol}${v}`)}
                onChange={(picked) => setCostPerKg(picked.replace(/[^\d.]/g, ""))}
                title="Select cost per kg"
                placeholder="Select"
              />
            </View>

            <View style={styles.row}>
              <View style={styles.halfField}>
                <FieldLabel>Minimum delivery fee</FieldLabel>
                <View style={styles.input}>
                  <TextInput
                    keyboardType="decimal-pad"
                    onChangeText={setMinFee}
                    placeholder="0.00"
                    placeholderTextColor="#858585"
                    style={styles.inputText}
                    value={minFee}
                  />
                </View>
              </View>
              <View style={styles.halfField}>
                <FieldLabel>Max order weight</FieldLabel>
                <SelectBox
                  value={maxWeight ? `${maxWeight}kg` : ""}
                  options={MAX_WEIGHT_OPTIONS.map((v) => `${v}kg`)}
                  onChange={(picked) => setMaxWeight(picked.replace(/[^\d.]/g, ""))}
                  title="Select max weight"
                  placeholder="Select"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <FieldLabel>Estimated delivery time</FieldLabel>
              <SelectBox
                value={deliveryTime}
                options={DELIVERY_TIME_OPTIONS}
                onChange={setDeliveryTime}
                title="Select delivery time"
                placeholder="Select"
              />
            </View>

            <View style={styles.fieldGroup}>
              <FieldLabel>Delivery notes</FieldLabel>
              <TextInput
                multiline
                onChangeText={setNotes}
                placeholder="Optional note for buyers.."
                placeholderTextColor="#858585"
                style={styles.notes}
                textAlignVertical="top"
                value={notes}
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={{ flex: 1, minHeight: 12 }} />

            <View style={styles.buttons}>
              <PrimaryButton
                disabled={submitting}
                onPress={handleSave}
                title={submitting ? "Saving..." : saveLabel}
              />
              <OutlineButton disabled={submitting} onPress={onBack} title="Back" />
            </View>
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
  sectionTitle: {
    color: "#1A1A1A",
    fontFamily: "Manrope-Bold",
    fontSize: 18,
    marginBottom: 22,
  },
  fieldGroup: { marginBottom: 16 },
  row: { flexDirection: "row", gap: 12, marginBottom: 16 },
  halfField: { flex: 1 },
  input: {
    height: 50,
    borderRadius: 12,
    backgroundColor: "#F4F4F4",
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  inputText: {
    color: "#282828",
    fontFamily: "Outfit-Regular",
    fontSize: 14,
  },
  notes: {
    minHeight: 110,
    borderRadius: 12,
    backgroundColor: "#F4F4F4",
    color: "#282828",
    fontFamily: "Outfit-Regular",
    fontSize: 14,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  errorText: { color: "#FB6363", fontSize: 13, fontFamily: "Outfit-Regular", marginTop: -4, marginBottom: 8 },
  buttons: { gap: 12 },
});
