import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  deliveryService,
  COUNTRY_LABEL,
  COUNTRY_CURRENCY,
  type DeliveryZone,
  type DeliveryCountryCode,
} from "../../services/deliveryService";
import { goBackOrReplace } from "../../utils/navigation";

const CURRENCY_SYMBOL: Record<string, string> = {
  GBP: "£",
  USD: "$",
  CAD: "C$",
  EUR: "€",
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

export default function DeliveryScreen() {
  const router = useRouter();
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Pause confirmation Modal state
  const [confirmPauseZone, setConfirmPauseZone] = useState<DeliveryZone | null>(null);

  // Add country selector Modal state
  const [showAddCountryModal, setShowAddCountryModal] = useState(false);

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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleToggleActive = async (zone: DeliveryZone) => {
    if (zone.active) {
      // Show pause confirmation dialog modal instead of instant action (Figma screen 37)
      setConfirmPauseZone(zone);
    } else {
      // Reactivate directly
      try {
        const updated = await deliveryService.setZoneActive(zone.id, true);
        setZones((prev) => prev.map((z) => (z.id === zone.id ? updated : z)));
      } catch (err) {
        Alert.alert("Error", err instanceof Error ? err.message : "Could not reactivate.");
      }
    }
  };

  const confirmPause = async () => {
    if (!confirmPauseZone) return;
    try {
      const updated = await deliveryService.setZoneActive(confirmPauseZone.id, false);
      setZones((prev) => prev.map((z) => (z.id === confirmPauseZone.id ? updated : z)));
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Could not pause delivery.");
    } finally {
      setConfirmPauseZone(null);
    }
  };

  const handleDeleteZone = (zone: DeliveryZone) => {
    Alert.alert(
      "Remove delivery country?",
      `Buyers in ${zone.countryCode === "EU" ? "Europe" : zone.country} will no longer be able to order from your store until you add it again.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await deliveryService.deleteZone(zone.id);
              setZones((prev) => prev.filter((item) => item.id !== zone.id));
            } catch (err) {
              Alert.alert("Error", err instanceof Error ? err.message : "Could not remove delivery country.");
            }
          },
        },
      ],
    );
  };

  const handleAddCountry = async (countryCode: DeliveryCountryCode) => {
    setShowAddCountryModal(false);
    try {
      const payload = {
        country: COUNTRY_LABEL[countryCode],
        countryCode,
        currency: COUNTRY_CURRENCY[countryCode],
        costPerKg: 4.0,
        minimumFee: 12.0,
        maxWeightKg: 10,
        estimatedDays: "3-5 days",
        active: true,
      };
      const created = await deliveryService.createZone(payload);
      // Route immediately to edit the newly created country zone
      router.push({ pathname: "/(vendor)/delivery-zone", params: { id: created.id } } as any);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Could not add delivery zone.");
    }
  };

  const availableCountryCodes: DeliveryCountryCode[] = (["UK", "US", "CA", "EU"] as DeliveryCountryCode[]).filter(
    (code) => !zones.some((z) => z.countryCode === code)
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)/settings" as any)} activeOpacity={0.85} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#F4F4F4', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <Ionicons name="arrow-back" size={22} color="#282828" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Manage delivery</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          Update where you sell and how delivery works for buyers
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading && (
          <View style={styles.placeholder}>
            <ActivityIndicator color="#076B51" size="large" />
          </View>
        )}

        {!loading && error ? <Text style={styles.errorText}>{error}</Text> : null}

        {!loading && !error && zones.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="airplane-outline" size={48} color="#858585" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>No delivery countries set yet.</Text>
            <Text style={styles.emptySubtitle}>
              Tap the button below to add your first delivery destination.
            </Text>
          </View>
        ) : null}

        {!loading &&
          zones.map((zone) => {
            const symbol = CURRENCY_SYMBOL[zone.currency] ?? "£";
            return (
              <View key={zone.id} style={styles.zoneCard}>
                {/* Header */}
                <View style={styles.zoneCardHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Text style={{ fontSize: 24 }}>{flagFor(zone)}</Text>
                    <Text style={styles.zoneCountryName}>
                      {zone.countryCode === "EU" ? "Europe (EU countries)" : zone.country}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, !zone.active && styles.statusBadgePaused]}>
                    <Text style={[styles.statusText, !zone.active && styles.statusTextPaused]}>
                      {zone.active ? "Active" : "Paused"}
                    </Text>
                  </View>
                </View>

                {/* Rates / Grid Layout */}
                <View style={styles.zoneGrid}>
                  <View style={styles.gridRow}>
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>Cost per kg:</Text>
                      <Text style={styles.gridValue}>
                        {symbol}
                        {zone.costPerKg.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>Minimum fee:</Text>
                      <Text style={styles.gridValue}>
                        {symbol}
                        {zone.minimumFee.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.gridRow}>
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>Currency:</Text>
                      <Text style={styles.gridValue}>{zone.currency}</Text>
                    </View>
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>Checkout status:</Text>
                      <Text style={styles.gridValue}>{zone.active ? "Accepting orders" : "Paused"}</Text>
                    </View>
                  </View>
                </View>

                {/* Actions Section */}
                <View style={styles.zoneActionsRow}>
                  <TouchableOpacity
                    onPress={() => handleToggleActive(zone)}
                    activeOpacity={0.8}
                    style={[styles.actionBtn, styles.actionBtnPause]}
                  >
                    <Text style={styles.actionBtnPauseText}>{zone.active ? "Pause" : "Reactivate"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      router.push({ pathname: "/(vendor)/delivery-zone", params: { id: zone.id } } as any)
                    }
                    activeOpacity={0.8}
                    style={[styles.actionBtn, styles.actionBtnEdit]}
                  >
                    <Text style={styles.actionBtnEditText}>Edit Now</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteZone(zone)}
                    activeOpacity={0.8}
                    style={[styles.actionBtn, styles.actionBtnDelete]}
                  >
                    <Text style={styles.actionBtnDeleteText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

        {/* Add another country trigger */}
        {!loading && availableCountryCodes.length > 0 && (
          <TouchableOpacity
            onPress={() => setShowAddCountryModal(true)}
            activeOpacity={0.85}
            style={styles.addCountryBtn}
          >
            <Ionicons name="add" size={20} color="#076B51" />
            <Text style={styles.addCountryBtnText}>Add another country</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ── Pause Confirmation Modal (Figma screen 37) ──────────────────────── */}
      <Modal
        visible={confirmPauseZone !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmPauseZone(null)}
      >
        <View style={styles.scrim}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pause delivery to {confirmPauseZone?.country}?</Text>
            <Text style={styles.modalBody}>
              Buyers in the {confirmPauseZone?.country} will no longer be able to place orders until you
              reactivate delivery
            </Text>

            <TouchableOpacity onPress={confirmPause} activeOpacity={0.86} style={styles.modalPrimaryBtn}>
              <Text style={styles.modalPrimaryBtnText}>Pause Delivery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setConfirmPauseZone(null)}
              activeOpacity={0.86}
              style={styles.modalCancelBtn}
            >
              <Text style={styles.modalCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Add Country Options Modal ────────────────────────────────────────── */}
      <Modal
        visible={showAddCountryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddCountryModal(false)}
      >
        <View style={styles.scrim}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Country</Text>
            <Text style={styles.modalBody}>Choose a country to enable deliveries to</Text>

            <View style={styles.countryOptionsList}>
              {availableCountryCodes.map((code) => (
                <TouchableOpacity
                  key={code}
                  onPress={() => handleAddCountry(code)}
                  activeOpacity={0.8}
                  style={styles.countryOptionRow}
                >
                  <Text style={styles.countryOptionText}>
                    {code === "EU" ? "Europe (France, Spain, Italy and more)" : COUNTRY_LABEL[code]}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#858585" />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => setShowAddCountryModal(false)}
              activeOpacity={0.86}
              style={[styles.modalCancelBtn, { marginTop: 14 }]}
            >
              <Text style={styles.modalCancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: {
    backgroundColor: "#076B51",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTitle: { fontSize: 26, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: "Outfit-Light",
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
    lineHeight: 18,
  },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 },
  placeholder: { paddingVertical: 50, alignItems: "center" },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", margin: 16 },
  emptyCard: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 30, alignItems: "center", marginBottom: 16 },
  emptyText: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 4 },
  emptySubtitle: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center" },

  // Zone Card structure matching Figma 043
  zoneCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  zoneCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F4F4F4",
    paddingBottom: 12,
    marginBottom: 12,
  },
  zoneCountryName: { fontSize: 17, fontFamily: "Manrope-Bold", color: "#282828" },
  statusBadge: { backgroundColor: "#E8F5EE", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgePaused: { backgroundColor: "#FFF3CD" },
  statusText: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#076B51" },
  statusTextPaused: { color: "#856B0E" },

  zoneGrid: { gap: 10, marginBottom: 16 },
  gridRow: { flexDirection: "row", justifyContent: "space-between" },
  gridItem: { flex: 1 },
  gridLabel: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", marginBottom: 2 },
  gridValue: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#1A1A1A" },

  zoneActionsRow: { flexDirection: "row", gap: 10 },
  actionBtn: { flex: 1, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actionBtnPause: { backgroundColor: "#F4F4F4" },
  actionBtnPauseText: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#282828" },
  actionBtnEdit: { backgroundColor: "#076B51" },
  actionBtnEditText: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  actionBtnDelete: { backgroundColor: "#FFF1F1" },
  actionBtnDeleteText: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#B42318" },

  // Add Country trigger button
  addCountryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E8F5EE",
    borderRadius: 16,
    height: 56,
    gap: 8,
    marginTop: 8,
  },
  addCountryBtnText: { fontSize: 15, fontFamily: "Manrope-SemiBold", color: "#076B51" },

  // Modals Styling
  scrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#1A1A1A", textAlign: "center", marginBottom: 10 },
  modalBody: {
    fontSize: 13,
    fontFamily: "Outfit-Regular",
    color: "#858585",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  modalPrimaryBtn: {
    width: "100%",
    height: 50,
    borderRadius: 14,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  modalPrimaryBtnText: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  modalCancelBtn: {
    width: "100%",
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E8E8E8",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelBtnText: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#858585" },

  // Dropdown list in country options
  countryOptionsList: { width: "100%", gap: 6 },
  countryOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F4F4F4",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  countryOptionText: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#1A1A1A" },
});
