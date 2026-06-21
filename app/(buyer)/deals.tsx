import React, { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { marketingService } from "../../services/marketingService";
import { goBackOrReplace } from "../../utils/navigation";

type BundleDeal = { id: string; vendorId: string; code: string; value: number; type: string; storeName: string; productIds: string[] };
type FlashDeal = { id: string; vendorId: string; code: string; value: number; type: string; storeName: string; productId: string; endsAt: string | null };

export default function DealsScreen() {
  const router = useRouter();
  const [bundles, setBundles] = useState<BundleDeal[]>([]);
  const [flashSales, setFlashSales] = useState<FlashDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const deals = await marketingService.getPublicDeals();
      setBundles(deals.bundles ?? []);
      setFlashSales(deals.flashSales ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load deals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const formatDiscount = (type: string, value: number) =>
    type === "PERCENTAGE" ? `${value}% off` : `$${(value / 100).toFixed(2)} off`;

  const formatTimeLeft = (endsAt: string | null) => {
    if (!endsAt) return "No expiry";
    const diff = new Date(endsAt).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `${hours}h left`;
    return `${Math.floor(hours / 24)}d left`;
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)/" as any)} activeOpacity={0.85} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Deals & Offers</Text>
        </View>
        <Text style={styles.headerSubtitle}>Bundles, flash sales, and discounts from vendors.</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#076B51" colors={["#076B51"]} />}
      >
        {loading ? (
          <View style={styles.placeholder}><ActivityIndicator color="#076B51" size="large" /></View>
        ) : error ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={28} color="#D6552F" />
            <Text style={styles.emptyTitle}>Couldn't load deals</Text>
            <Text style={styles.emptyText}>{error}</Text>
          </View>
        ) : bundles.length === 0 && flashSales.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="pricetags-outline" size={32} color="#858585" />
            <Text style={styles.emptyTitle}>No deals right now</Text>
            <Text style={styles.emptyText}>Vendors haven't published any bundles or flash sales yet. Check back soon!</Text>
          </View>
        ) : (
          <>
            {flashSales.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Flash Sales</Text>
                {flashSales.map((sale) => (
                  <TouchableOpacity
                    key={sale.id}
                    activeOpacity={0.85}
                    onPress={() => router.push({ pathname: "/(buyer)/vendor-detail", params: { id: sale.vendorId } } as any)}
                  >
                    <LinearGradient colors={["#E14B4B", "#B3211F"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.dealCard}>
                      <Ionicons name="flash" size={22} color="#FFFFFF" />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.dealTitle}>{formatDiscount(sale.type, sale.value)}</Text>
                        <Text style={styles.dealSub}>{sale.storeName}</Text>
                        <Text style={styles.dealMeta}>Code: {sale.code} · {formatTimeLeft(sale.endsAt)}</Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </>
            ) : null}

            {bundles.length > 0 ? (
              <>
                <Text style={[styles.sectionTitle, flashSales.length > 0 && { marginTop: 20 }]}>Bundles</Text>
                {bundles.map((bundle) => (
                  <TouchableOpacity
                    key={bundle.id}
                    activeOpacity={0.85}
                    onPress={() => router.push({ pathname: "/(buyer)/vendor-detail", params: { id: bundle.vendorId } } as any)}
                  >
                    <LinearGradient colors={["#076B51", "#0B8A5F"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.dealCard}>
                      <Ionicons name="cube-outline" size={22} color="#FFFFFF" />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.dealTitle}>{formatDiscount(bundle.type, bundle.value)}</Text>
                        <Text style={styles.dealSub}>{bundle.storeName}</Text>
                        <Text style={styles.dealMeta}>Code: {bundle.code} · {bundle.productIds.length} products</Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: { backgroundColor: "#076B51", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 26, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 13, fontFamily: "Outfit-Light", color: "rgba(255,255,255,0.8)", marginTop: 6, lineHeight: 18 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 100 },
  sectionTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 12 },
  placeholder: { paddingVertical: 40, alignItems: "center" },
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828" },
  emptyText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", maxWidth: 260 },
  dealCard: { flexDirection: "row", alignItems: "center", borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  dealTitle: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  dealSub: { fontSize: 13, fontFamily: "Outfit-Regular", color: "rgba(255,255,255,0.85)", marginTop: 2 },
  dealMeta: { fontSize: 11, fontFamily: "Outfit-Light", color: "rgba(255,255,255,0.7)", marginTop: 4 },
});
