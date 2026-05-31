import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { deliveryService, type DeliveryZone } from "../../services/deliveryService";
import {
  FormCard,
  OnboardingHeader,
  OutlineButton,
  PrimaryButton,
} from "../../components/onboarding/FigmaNativeUI";

const CURRENCY_SYMBOL: Record<string, string> = {
  GBP: "£",
  USD: "$",
  CAD: "C$",
  EUR: "€",
};

// Country flag emoji map (no external assets required)
const FLAG: Record<string, string> = {
  UK: "🇬🇧",
  US: "🇺🇸",
  CA: "🇨🇦",
  EU: "🇪🇺",
};

function flagFor(zone: DeliveryZone) {
  const code = (zone.countryCode ?? "").toUpperCase();
  const name = (zone.country ?? "").toLowerCase();
  
  if (code === "UK" || name.includes("united kingdom") || name.includes("uk") || name.includes("great britain")) {
    return "🇬🇧";
  }
  if (code === "US" || name.includes("united states") || name.includes("us") || name.includes("america")) {
    return "🇺🇸";
  }
  if (code === "CA" || name.includes("canada") || name.includes("ca")) {
    return "🇨🇦";
  }
  if (code === "EU" || name.includes("europe") || name.includes("european union") || name.includes("eu")) {
    return "🇪🇺";
  }
  return "🌍";
}

export default function DeliverySummaryScreen() {
  const router = useRouter();
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await deliveryService.listZones();
      setZones(list ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load delivery zones.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleTogglePause = async (zone: DeliveryZone) => {
    try {
      const updated = await deliveryService.setZoneActive(zone.id, !zone.active);
      setZones((prev) => prev.map((z) => (z.id === zone.id ? updated : z)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update zone.");
    }
  };

  const renderZone = (zone: DeliveryZone) => {
    const symbol = CURRENCY_SYMBOL[zone.currency] ?? `${zone.currency} `;
    return (
      <View key={zone.id} style={styles.countryCard}>
        <View style={styles.cardHeader}>
          <View style={styles.countryNameRow}>
            <Text style={styles.flag}>{flagFor(zone)}</Text>
            <Text style={styles.countryName}>{zone.country}</Text>
          </View>
          <View style={[styles.statusBadge, !zone.active && styles.pausedBadge]}>
            <Text style={[styles.statusText, !zone.active && styles.pausedText]}>
              {zone.active ? "Active" : "Paused"}
            </Text>
          </View>
        </View>

        <View style={styles.detailGrid}>
          <View style={styles.detailCol}>
            <Text style={styles.detailLabel}>Cost per kg:</Text>
            <Text style={styles.detailValue}>
              {symbol}
              {zone.costPerKg.toFixed(2)}
            </Text>
          </View>
          <View style={styles.detailCol}>
            <Text style={styles.detailLabel}>Minimum fee:</Text>
            <Text style={styles.detailValue}>
              {symbol}
              {zone.minimumFee.toFixed(2)}
            </Text>
          </View>
          <View style={styles.detailCol}>
            <Text style={styles.detailLabel}>Max order weight:</Text>
            <Text style={styles.detailValue}>{zone.maxWeightKg}kg</Text>
          </View>
          <View style={styles.detailCol}>
            <Text style={styles.detailLabel}>Delivery estimate:</Text>
            <Text style={styles.detailValue}>{zone.estimatedDays}</Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            onPress={() => handleTogglePause(zone)}
            activeOpacity={0.85}
            style={styles.pauseBtn}
          >
            <Text style={styles.pauseBtnText}>{zone.active ? "Pause" : "Resume"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/(vendor-onboarding)/delivery-countries" as any)}
            activeOpacity={0.85}
            style={styles.editBtn}
          >
            <Text style={styles.editBtnText}>Edit Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <OnboardingHeader
        activeSegments={7}
        subtitle={"Review where you can sell and how delivery\nwill work"}
        title={"Your delivery setup"}
      />

      <FormCard>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Delivery Summary</Text>

          {loading ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator color="#076B51" />
            </View>
          ) : null}

          {!loading && error ? <Text style={styles.errorText}>{error}</Text> : null}

          {!loading && zones.length === 0 && !error ? (
            <Text style={styles.emptyText}>You haven't set up any delivery zones yet.</Text>
          ) : null}

          {!loading ? zones.map(renderZone) : null}

          <View style={{ flex: 1, minHeight: 16 }} />

          <View style={styles.buttons}>
            <PrimaryButton
              onPress={() => router.push("/(vendor-onboarding)/store-ready" as any)}
              title="Continue"
            />
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={() => router.push("/(vendor-onboarding)/delivery-countries" as any)}
              style={styles.addAnotherBtn}
            >
              <Text style={styles.addAnotherText}>Add another country</Text>
              <View style={styles.addCircle}>
                <Ionicons name="add" size={14} color="#076B51" />
              </View>
            </TouchableOpacity>
          </View>
          <View style={{ height: 12 }} />
        </ScrollView>
      </FormCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#076B51" },
  scrollBody: { flexGrow: 1, paddingBottom: 16 },
  sectionTitle: { color: "#1A1A1A", fontFamily: "Manrope-Bold", fontSize: 18, marginBottom: 18 },
  loadingBlock: { paddingVertical: 30, alignItems: "center" },
  emptyText: {
    fontSize: 13,
    fontFamily: "Outfit-Regular",
    color: "#858585",
    textAlign: "center",
    paddingVertical: 24,
  },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", marginBottom: 14 },

  countryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EFEFEF",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  countryNameRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  flag: { fontSize: 24 },
  countryName: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#1A1A1A" },
  statusBadge: {
    backgroundColor: "rgba(7,107,81,0.10)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(7,107,81,0.18)",
  },
  statusText: { fontSize: 11, fontFamily: "Manrope-Bold", color: "#076B51" },
  pausedBadge: { backgroundColor: "rgba(217,119,6,0.10)", borderColor: "rgba(217,119,6,0.20)" },
  pausedText: { color: "#D97706" },

  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 12,
    columnGap: 16,
    marginBottom: 16,
  },
  detailCol: { width: "47%", minWidth: 120 },
  detailLabel: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585" },
  detailValue: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#1A1A1A", marginTop: 4 },

  cardActions: { flexDirection: "row", gap: 10 },
  pauseBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#076B51",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  pauseBtnText: { color: "#076B51", fontSize: 13, fontFamily: "Manrope-SemiBold" },
  editBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
  },
  editBtnText: { color: "#FFFFFF", fontSize: 13, fontFamily: "Manrope-SemiBold" },

  buttons: { gap: 12 },
  addAnotherBtn: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#076B51",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addAnotherText: { color: "#076B51", fontSize: 15, fontFamily: "Manrope-SemiBold" },
  addCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.2,
    borderColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
  },
});
