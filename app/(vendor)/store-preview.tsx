import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { vendorService } from "../../services/vendorService";
import { RemoteImage } from "../../components/ui/RemoteImage";

const CURRENCY_SYMBOL: Record<string, string> = { GBP: "£", USD: "$", EUR: "€", NGN: "₦" };

/**
 * Vendor-activation spec: "Vendors should be able to preview their complete
 * storefront before it becomes publicly visible." This is a real preview —
 * it includes PENDING_ACTIVATION listings with their own badge, distinct
 * from the public /store/[slug] page which (correctly) only ever shows
 * what buyers can actually see.
 */
export default function StorePreviewScreen() {
  const router = useRouter();
  const [data, setData] = useState<Awaited<ReturnType<typeof vendorService.getStorePreview>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await vendorService.getStorePreview());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your store preview.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const pendingCount = data?.products.filter((p) => !p.visibleToBuyers).length ?? 0;

  return (
    <View style={styles.page}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)/activation" as any)} style={styles.backButton} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Preview your store</Text>
          <Text style={styles.headerSubtitle}>
            {data?.verificationStatus === "VERIFIED"
              ? "This is exactly what buyers see."
              : "This includes listings buyers can't see yet — verify your account to make them live."}
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.placeholder}>
            <ActivityIndicator color="#076B51" />
          </View>
        ) : null}

        {!loading && error ? <Text style={styles.errorText}>{error}</Text> : null}

        {!loading && data ? (
          <>
            <View style={styles.storeCard}>
              <View style={styles.storeAvatar}>
                <RemoteImage uri={data.avatar ?? undefined} style={styles.storeAvatarInner} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.storeName}>{data.storeName}</Text>
                <Text style={styles.storeLocation}>{[data.city, data.country].filter(Boolean).join(", ") || "Location not set"}</Text>
              </View>
            </View>

            {pendingCount > 0 ? (
              <View style={styles.noticeBox}>
                <Ionicons name="time-outline" size={16} color="#B07C00" />
                <Text style={styles.noticeText}>
                  {pendingCount} of {data.products.length} listing{data.products.length === 1 ? "" : "s"} {pendingCount === 1 ? "is" : "are"} awaiting activation — not visible to buyers yet.
                </Text>
              </View>
            ) : null}

            {data.products.length === 0 ? (
              <Text style={styles.emptyText}>No listings yet. Add your first foodstuff to see it here.</Text>
            ) : null}

            {data.products.map((product) => {
              const symbol = CURRENCY_SYMBOL[product.currency?.toUpperCase()] ?? "£";
              return (
                <View key={product.id} style={styles.productCard}>
                  <View style={styles.productImage}>
                    <RemoteImage uri={product.images?.[0]} style={styles.productImageInner} />
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={1}>{product.title}</Text>
                    <Text style={styles.productPrice}>{symbol}{(product.priceInCents / 100).toFixed(2)}</Text>
                  </View>
                  <View style={[styles.statusBadge, product.visibleToBuyers ? styles.statusLive : styles.statusPending]}>
                    <Text style={[styles.statusText, product.visibleToBuyers ? styles.statusTextLive : styles.statusTextPending]}>
                      {product.visibleToBuyers ? "Live" : "Awaiting activation"}
                    </Text>
                  </View>
                </View>
              );
            })}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F4F4F4" },
  headerSafeArea: { backgroundColor: "#076B51" },
  header: { backgroundColor: "#076B51", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  headerTitle: { fontSize: 22, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 13, fontFamily: "Outfit-Regular", color: "rgba(255,255,255,0.8)", marginTop: 6, lineHeight: 18 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  placeholder: { paddingVertical: 60, alignItems: "center" },
  errorText: { color: "#FB6363", fontFamily: "Outfit-Regular", fontSize: 14, textAlign: "center", marginTop: 20 },
  emptyText: { color: "#858585", fontFamily: "Outfit-Regular", fontSize: 14, textAlign: "center", marginTop: 20 },
  storeCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, marginBottom: 14 },
  storeAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#F4F4F4", overflow: "hidden" },
  storeAvatarInner: { width: "100%", height: "100%" },
  storeName: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828" },
  storeLocation: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },
  noticeBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFF6E0", borderRadius: 14, padding: 14, marginBottom: 14 },
  noticeText: { flex: 1, fontSize: 13, fontFamily: "Outfit-Medium", color: "#B07C00", lineHeight: 18 },
  productCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFFFFF", borderRadius: 16, padding: 12, marginBottom: 10 },
  productImage: { width: 52, height: 52, borderRadius: 12, backgroundColor: "#F4F4F4", overflow: "hidden" },
  productImageInner: { width: "100%", height: "100%" },
  productInfo: { flex: 1 },
  productName: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#282828" },
  productPrice: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },
  statusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  statusLive: { backgroundColor: "rgba(7,107,81,0.1)" },
  statusPending: { backgroundColor: "rgba(176,124,0,0.1)" },
  statusText: { fontSize: 11, fontFamily: "Outfit-Medium" },
  statusTextLive: { color: "#076B51" },
  statusTextPending: { color: "#B07C00" },
});
