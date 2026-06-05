import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { buyerService, type VendorBuyerSummary } from "../../services/buyerService";

const CURRENCY_SYMBOL: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "\u20AC",
};

function formatLastOrder(value: string | null): string {
  if (!value) return "No orders yet";
  try {
    return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return value;
  }
}

export default function BuyersScreen() {
  const router = useRouter();
  const [buyers, setBuyers] = useState<VendorBuyerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await buyerService.listMyBuyers();
      setBuyers(list ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your buyers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = (buyers ?? []).filter((b) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      b.name.toLowerCase().includes(q) ||
      (b.email ?? "").toLowerCase().includes(q) ||
      b.country.toLowerCase().includes(q)
    );
  });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your buyers</Text>
        <Text style={styles.headerSubtitle}>View your buyers, track orders, and understand their purchase behavior.</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Buyers List</Text>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#858585" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search buyers, order.."
            placeholderTextColor="#858585"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {loading && (
          <View style={styles.placeholder}>
            <ActivityIndicator color="#076B51" />
          </View>
        )}

        {!loading && error ? <Text style={styles.errorText}>{error}</Text> : null}

        {!loading && !error && filtered.length === 0 ? (
          <Text style={styles.emptyText}>
            {buyers.length === 0
              ? "No buyers yet. Once orders come in, your buyers will appear here."
              : "No buyers match this search."}
          </Text>
        ) : null}

        {!loading && filtered.map((buyer) => {
          const symbol = CURRENCY_SYMBOL[buyer.currency] ?? "\u00A3";
          return (
            <View key={buyer.id} style={styles.buyerCard}>
              <View style={styles.buyerTop}>
                <View style={styles.buyerAvatar}>
                  <Ionicons name="person" size={24} color="#858585" />
                </View>
                <View style={styles.buyerInfo}>
                  <View style={styles.buyerNameRow}>
                    <Text style={styles.buyerName} numberOfLines={1}>{buyer.name}</Text>
                    <View style={styles.countryBadge}>
                      <Text style={styles.countryText}>{buyer.country}</Text>
                    </View>
                  </View>
                  {buyer.email ? <Text style={styles.buyerEmail} numberOfLines={1}>{buyer.email}</Text> : null}
                </View>
              </View>

              <View style={styles.buyerDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Last order date</Text>
                  <Text style={styles.detailValue}>{formatLastOrder(buyer.lastOrderAt)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Total orders</Text>
                  <Text style={styles.detailValue}>{buyer.totalOrders}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Total spent</Text>
                  <Text style={styles.detailValue}>{symbol}{buyer.totalSpent.toFixed(2)}</Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() =>
                  router.push({ pathname: "/(vendor)/buyers-profile", params: { id: buyer.id } } as any)
                }
                activeOpacity={0.85}
                style={styles.viewButton}
              >
                <Text style={styles.viewButtonText}>View Profile</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: { backgroundColor: "#076B51", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTitle: { fontSize: 26, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 13, fontFamily: "Outfit-Light", color: "rgba(255,255,255,0.8)", marginTop: 6, lineHeight: 18 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 100 },
  sectionTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 12 },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, height: 48, paddingHorizontal: 14, gap: 10, marginBottom: 16, borderWidth: 1, borderColor: "#E8E8E8" },
  searchInput: { flex: 1, fontSize: 14, color: "#282828" },
  placeholder: { paddingVertical: 30, alignItems: "center" },
  emptyText: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", paddingVertical: 30 },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", marginBottom: 16 },
  buyerCard: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, marginBottom: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  buyerTop: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  buyerAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center", marginRight: 12 },
  buyerInfo: { flex: 1 },
  buyerNameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  buyerName: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828", flex: 1, marginRight: 8 },
  countryBadge: { borderWidth: 1, borderColor: "#E0E0E0", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  countryText: { fontSize: 11, fontFamily: "Outfit-Medium", color: "#282828" },
  buyerEmail: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#076B51", marginTop: 2 },
  buyerDetails: { marginBottom: 12 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  detailLabel: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585" },
  detailValue: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#282828" },
  viewButton: { height: 44, borderRadius: 12, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  viewButtonText: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
});

