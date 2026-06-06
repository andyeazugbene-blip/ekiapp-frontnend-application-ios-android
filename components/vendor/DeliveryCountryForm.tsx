/**
 * Shared form for the four onboarding delivery-country screens
 * (UK / US / Canada / Europe).
 *
 * Vendors can choose either a weight-based fee or a flat delivery fee.
 */
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
  afterCountry: DeliveryCountry;
  onSaved: (nextRoute: string) => void;
  onBack: () => void;
}

const COST_PER_KG_OPTIONS = ["2", "3", "4", "5", "6", "7", "8", "10", "12", "15"];
const FLAT_FEE_OPTIONS = ["5", "7", "10", "12", "15", "20", "25", "30"];
const MAX_WEIGHT_OPTIONS = ["5", "10", "15", "20", "25", "30"];
const DELIVERY_TIME_OPTIONS = ["1-2 days", "2-3 days", "3-5 days", "5-7 days", "7-10 days", "10-14 days"];

type PricingModel = "weight" | "flat";

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

  const [pricingModel, setPricingModel] = useState<PricingModel>("weight");
  const [costPerKg, setCostPerKg] = useState("");
  const [flatFee, setFlatFee] = useState("");
  const [minFee, setMinFee] = useState("");
  const [maxWeight, setMaxWeight] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("3-5 days");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    setError("");

    const parsedCostPerKg = Number(costPerKg.replace(/[^\d.]/g, ""));
    const parsedFlatFee = Number(flatFee.replace(/[^\d.]/g, ""));
    const parsedMinFee = Number(minFee.replace(/[^\d.]/g, ""));
    const parsedMaxWeight = Number(maxWeight.replace(/[^\d.]/g, ""));

    if (pricingModel === "weight" && (!Number.isFinite(parsedCostPerKg) || parsedCostPerKg <= 0)) {
      setError("Please select a delivery cost per kg.");
      return;
    }

    if (pricingModel === "flat" && (!Number.isFinite(parsedFlatFee) || parsedFlatFee <= 0)) {
      setError("Please select a flat delivery fee.");
      return;
    }

    if (pricingModel === "weight" && (!Number.isFinite(parsedMinFee) || parsedMinFee < 0)) {
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
        costPerKg: pricingModel === "weight" ? parsedCostPerKg : 0,
        minimumFee: pricingModel === "weight" ? parsedMinFee : parsedFlatFee,
        maxWeightKg: parsedMaxWeight,
        estimatedDays: deliveryTime,
        notes:
          [
            pricingModel === "flat" ? "Flat delivery fee enabled." : "Weight-based delivery fee enabled.",
            notes.trim(),
          ]
            .filter(Boolean)
            .join(" ")
            .trim() || undefined,
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
          subtitle={"Choose how you want buyers charged for\nthis delivery zone"}
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
              <FieldLabel>Delivery pricing model</FieldLabel>
              <View style={styles.modeRow}>
                <ModeChip
                  label="Weight based"
                  selected={pricingModel === "weight"}
                  onPress={() => {
                    setPricingModel("weight");
                    setError("");
                  }}
                />
                <ModeChip
                  label="Flat fee"
                  selected={pricingModel === "flat"}
                  onPress={() => {
                    setPricingModel("flat");
                    setError("");
                  }}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <FieldLabel>Delivery cost per kg</FieldLabel>
              {pricingModel === "weight" ? (
                <SelectBox
                  value={costPerKg ? `${currencySymbol}${costPerKg}` : ""}
                  options={COST_PER_KG_OPTIONS.map((v) => `${currencySymbol}${v}`)}
                  onChange={(picked) => setCostPerKg(picked.replace(/[^\d.]/g, ""))}
                  title="Select cost per kg"
                  placeholder="Select"
                />
              ) : (
                <View style={styles.disabledField}>
                  <Text style={styles.disabledFieldText}>Not used for flat-fee delivery</Text>
                </View>
              )}
            </View>

            <View style={styles.row}>
              <View style={styles.halfField}>
                <FieldLabel>{pricingModel === "weight" ? "Minimum delivery fee" : "Flat delivery fee"}</FieldLabel>
                {pricingModel === "weight" ? (
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
                ) : (
                  <SelectBox
                    value={flatFee ? `${currencySymbol}${flatFee}` : ""}
                    options={FLAT_FEE_OPTIONS.map((v) => `${currencySymbol}${v}`)}
                    onChange={(picked) => setFlatFee(picked.replace(/[^\d.]/g, ""))}
                    title="Select flat delivery fee"
                    placeholder="Select"
                  />
                )}
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
                placeholder="Optional note for buyers..."
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

function ModeChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.modeChip, selected && styles.modeChipActive]}>
      <Text style={[styles.modeChipText, selected && styles.modeChipTextActive]}>{label}</Text>
    </Pressable>
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
  modeRow: { flexDirection: "row", gap: 10 },
  modeChip: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDE3DF",
    backgroundColor: "#F4F4F4",
    alignItems: "center",
    justifyContent: "center",
  },
  modeChipActive: {
    backgroundColor: "#076B51",
    borderColor: "#076B51",
  },
  modeChipText: {
    color: "#4A4F54",
    fontFamily: "Outfit-Medium",
    fontSize: 14,
  },
  modeChipTextActive: {
    color: "#FFFFFF",
  },
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
  disabledField: {
    height: 50,
    borderRadius: 12,
    backgroundColor: "#ECEFEE",
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  disabledFieldText: {
    color: "#7A8084",
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
  errorText: {
    color: "#FB6363",
    fontSize: 13,
    fontFamily: "Outfit-Regular",
    marginTop: -4,
    marginBottom: 8,
  },
  buttons: { gap: 12 },
});
