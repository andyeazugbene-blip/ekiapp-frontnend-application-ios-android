import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { vendorService, type VendorMarket } from "../../services/vendorService";
import { useFocusRefresh } from "../../hooks/useFocusRefresh";
import { goBackOrReplace } from "../../utils/navigation";
import { COUNTRIES } from "../../utils/countries";

export default function VendorMarketsScreen() {
  const router = useRouter();
  const [markets, setMarkets] = useState<VendorMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [addPickerOpen, setAddPickerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setMarkets(await vendorService.getMyMarkets());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your markets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusRefresh(load);

  const activeCount = markets.filter((m) => m.enabled).length;
  const assignedCodes = new Set(markets.map((m) => m.marketCode));
  const addableCountries = COUNTRIES.filter((c) => !assignedCodes.has(c.code));

  const handleAdd = async (countryName: string) => {
    setAddPickerOpen(false);
    setBusyCode("adding");
    setError("");
    try {
      const market = await vendorService.addMyMarket(countryName);
      setMarkets((current) => [...current.filter((m) => m.marketCode !== market.marketCode), market]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that market.");
    } finally {
      setBusyCode(null);
    }
  };

  const handleToggle = async (market: VendorMarket, enabled: boolean) => {
    if (!enabled && activeCount <= 1) {
      Alert.alert("At least one market required", "Add another market before disabling your last active one.");
      return;
    }
    setBusyCode(market.marketCode);
    setError("");
    try {
      const updated = await vendorService.setMyMarketEnabled(market.marketCode, enabled);
      setMarkets((current) => current.map((m) => (m.marketCode === updated.marketCode ? updated : m)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update that market.");
    } finally {
      setBusyCode(null);
    }
  };

  const handleRemove = (market: VendorMarket) => {
    if (activeCount <= 1 && market.enabled) {
      Alert.alert("At least one market required", "Add another market before removing your last active one.");
      return;
    }
    Alert.alert(
      `Remove ${market.countryName}?`,
      "Your store will no longer be eligible for Regular Deliveries or Community Buy in this market.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setBusyCode(market.marketCode);
            setError("");
            try {
              await vendorService.removeMyMarket(market.marketCode);
              setMarkets((current) => current.filter((m) => m.marketCode !== market.marketCode));
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not remove that market.");
            } finally {
              setBusyCode(null);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)/settings" as any)} activeOpacity={0.85} accessibilityLabel="Go back" accessibilityRole="button" style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Markets You Serve</Text>
          <Text style={styles.headerSubtitle}>Each market resolves its own currency and eligibility — adding one never changes another.</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.centerBlock}><ActivityIndicator color="#076B51" /></View>
        ) : (
          <>
            <View style={styles.card}>
              {markets.map((market) => (
                <View key={market.marketCode} style={styles.marketRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.marketName}>{market.countryName}</Text>
                    <Text style={styles.marketMeta}>{market.currency}{!market.enabled ? " · Inactive" : ""}</Text>
                  </View>
                  {busyCode === market.marketCode ? (
                    <ActivityIndicator size="small" color="#076B51" />
                  ) : (
                    <>
                      <Switch
                        value={market.enabled}
                        onValueChange={(value) => void handleToggle(market, value)}
                        trackColor={{ false: "#E0E0E0", true: "#076B51" }}
                        thumbColor="#FFFFFF"
                      />
                      <TouchableOpacity onPress={() => handleRemove(market)} activeOpacity={0.75} style={styles.removeButton}>
                        <Ionicons name="trash-outline" size={18} color="#E53935" />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              ))}
              {markets.length === 0 ? <Text style={styles.emptyText}>No markets configured yet.</Text> : null}
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {addableCountries.length > 0 ? (
              <TouchableOpacity
                onPress={() => setAddPickerOpen((v) => !v)}
                activeOpacity={0.85}
                style={styles.addButton}
                disabled={busyCode === "adding"}
              >
                {busyCode === "adding" ? (
                  <ActivityIndicator color="#076B51" />
                ) : (
                  <>
                    <Ionicons name="add-circle-outline" size={20} color="#076B51" />
                    <Text style={styles.addButtonText}>Add a market</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}

            {addPickerOpen ? (
              <View style={styles.addList}>
                {addableCountries.map((c) => (
                  <TouchableOpacity key={c.code} onPress={() => void handleAdd(c.name)} activeOpacity={0.8} style={styles.addListRow}>
                    <Text style={styles.addListText}>{c.name}</Text>
                    <Ionicons name="chevron-forward" size={16} color="#8AA194" />
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <View style={styles.notice}>
              <Ionicons name="information-circle-outline" size={16} color="#076B51" />
              <Text style={styles.noticeText}>
                Only Eki's approved launch markets are selectable. Each market must resolve independently — your products, delivery zones, and Community Buy eligibility never mix currencies across markets.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 24, fontFamily: "Manrope-Bold", color: "#282828" },
  headerSubtitle: { fontSize: 13, lineHeight: 18, fontFamily: "Outfit-Regular", color: "#687076", marginTop: 4 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
  centerBlock: { paddingVertical: 60, alignItems: "center" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 8, marginBottom: 16 },
  marketRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: "#F4F4F4" },
  marketName: { fontSize: 15, fontFamily: "Manrope-SemiBold", color: "#282828" },
  marketMeta: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },
  removeButton: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", padding: 16, textAlign: "center" },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", marginBottom: 12 },
  addButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: 14, backgroundColor: "#EAF5F0", marginBottom: 8 },
  addButtonText: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  addList: { backgroundColor: "#FFFFFF", borderRadius: 16, marginBottom: 16, overflow: "hidden" },
  addListRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#F4F4F4" },
  addListText: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828" },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#EAF5F0", borderRadius: 16, padding: 14, marginTop: 4 },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: "Outfit-Regular", color: "#24564A" },
});
