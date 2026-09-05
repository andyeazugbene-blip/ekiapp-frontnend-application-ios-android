import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { vendorService } from "../../services/vendorService";
import { productService } from "../../services/productService";
import { reviewService, type ReviewsWithStats } from "../../services/reviewService";
import { deliveryService, type DeliveryZone } from "../../services/deliveryService";
import { useCartStore } from "../../stores/cartStore";
import { showCurrencySwitchNotice } from "../../utils/cartCurrencyAlert";
import type { VendorSummary } from "../../types/vendor";
import type { Product, Review } from "../../types/product";
import { RemoteImage } from "../../components/ui/RemoteImage";
import { openConversationThread } from "../../utils/messaging";
import { goBackOrReplace } from "../../utils/navigation";
import { ReportModal } from "../../components/ui/ReportModal";
import { useCurrencyStore } from "../../stores/currencyStore";
import { formatDisplayMoney } from "../../utils/currency";

export default function VendorDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { selectedCurrency } = useCurrencyStore();
  const addItem = useCartStore((state) => state.addItem);

  const [vendor, setVendor] = useState<VendorSummary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewStats, setReviewStats] = useState<{ averageRating: number; totalReviews: number }>({ averageRating: 0, totalReviews: 0 });
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportTarget, setReportTarget] = useState<{ type: "review" | "store"; id: string; label: string } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let cancelled = false;
      setLoading(true);

      Promise.all([
        vendorService.getVendorById(id),
        productService.getAll({ vendorId: id, limit: 10 }),
        reviewService.getForVendor(id).catch((): ReviewsWithStats => ({ reviews: [], averageRating: 0, totalReviews: 0 })),
        deliveryService.listAllZones().catch(() => [] as DeliveryZone[]),
      ])
        .then(([nextVendor, nextProducts, nextReviewData, nextZones]) => {
          if (cancelled) return;
          setVendor(nextVendor);
          setProducts(nextProducts ?? []);
          setReviews(nextReviewData.reviews);
          setReviewStats({ averageRating: nextReviewData.averageRating, totalReviews: nextReviewData.totalReviews });
          setZones(nextZones ?? []);
        })
        .catch(() => {
          if (cancelled) return;
          setVendor(null);
          setProducts([]);
          setReviews([]);
          setZones([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [id]),
  );

  if (loading) {
    return (
      <View style={styles.stateScreen}>
        <ActivityIndicator color="#076B51" />
      </View>
    );
  }

  if (!vendor) {
    return (
      <SafeAreaView style={styles.stateScreen} edges={["top"]}>
        <Ionicons name="storefront-outline" size={42} color="#9AA3A0" />
        <Text style={styles.stateTitle}>Store not found</Text>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)" as any)} activeOpacity={0.86} style={styles.stateButton}>
          <Text style={styles.stateButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const deliveryCountries = zones.length > 0
    ? Array.from(new Set(zones.filter((zone) => zone.active).map((zone) => zone.country).filter(Boolean)))
    : [vendor.country].filter(Boolean);

  const handleAddToCart = (product: Product) => {
    addItem(product, 1)
      .then((result) => {
        if (result.switchedCurrency && result.previousCurrency) {
          showCurrencySwitchNotice(result.previousCurrency, result.currency);
        }
      })
      .catch((err) => {
        Alert.alert("Cart not updated", err instanceof Error ? err.message : "Could not add this item to your cart.");
      });
  };

  const handleMessageVendor = () => {
    const participantId =
      vendor.userId ??
      products.find((product) => (product as any).vendorUserId)?.vendorUserId ??
      undefined;

    if (!participantId) {
      Alert.alert("Message unavailable", "This vendor cannot receive messages at the moment. Please try again later or contact support.");
      return;
    }

    openConversationThread({
      participantId,
      participantName: vendor.storeName,
      participantAvatar: vendor.avatar ?? vendor.coverImage,
      participantRole: "vendor",
    })
      .then(() => router.push("/(buyer)/message-chat" as any))
      .catch((err) => {
        Alert.alert("Message unavailable", err instanceof Error ? err.message : "Could not open the conversation.");
      });
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <RemoteImage uri={vendor.coverImage} style={styles.heroImage} borderRadius={0} fallbackIcon="storefront-outline" />
        <View style={styles.heroOverlay} />
        <SafeAreaView edges={["top"]} style={styles.heroSafe}>
          <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)" as any)} activeOpacity={0.86} style={styles.heroButton}>
            <Ionicons name="arrow-back" size={22} color="#0A6C52" />
          </TouchableOpacity>
        </SafeAreaView>
        <View style={styles.heroCopy}>
          <Text style={styles.storeName}>{vendor.storeName}</Text>
          <View style={styles.ratingRow}>
            <Text style={styles.ratingText}>
            {reviewStats.averageRating > 0
              ? `${reviewStats.averageRating.toFixed(1)} (${reviewStats.totalReviews} reviews)`
              : vendor.rating > 0
                ? `${vendor.rating.toFixed(1)} (${vendor.totalReviews ?? 0} reviews)`
                : "No reviews yet"}
          </Text>
            <Ionicons name="star" size={18} color="#F4B400" />
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Store info</Text>
          <Text style={styles.storeDesc}>
            {vendor.description?.trim() || `Authentic African foodstuff from ${vendor.city}, ${vendor.country}.`}
          </Text>

          {vendor.verificationStatus === "verified" ? (
            <View style={styles.infoStrip}>
              <View style={styles.infoBadge}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#076B51" />
                <Text style={styles.infoBadgeText}>Verified vendor</Text>
              </View>
              <Text style={styles.infoStripText}>Message the vendor directly and keep everything on Eki.</Text>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>Available foodstuff</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productsScroll}>
            {products.map((product) => {
              return (
                <TouchableOpacity
                  key={product.id}
                  onPress={() => router.push({ pathname: "/(buyer)/product-detail", params: { id: product.id } } as any)}
                  activeOpacity={0.86}
                  style={styles.productCard}
                >
                  <View style={{ position: "relative" }}>
                    <RemoteImage uri={product.images?.[0]} style={styles.productImage} borderRadius={18} fallbackIcon="cube-outline" />
                    <View style={styles.heartBadge}>
                      <Ionicons name="heart-outline" size={16} color="#076B51" />
                    </View>
                  </View>
                  <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                  <Text style={styles.productPrice}>{formatDisplayMoney(product.price, product.currency, selectedCurrency)}</Text>
                  <TouchableOpacity onPress={() => handleAddToCart(product)} activeOpacity={0.86} style={styles.addButton}>
                    <Text style={styles.addButtonText}>Add to cart</Text>
                    <Ionicons name="cart-outline" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.sectionTitle}>Delivery countries</Text>
          <View style={styles.countryRow}>
            {deliveryCountries.length > 0 ? (
              deliveryCountries.map((country) => (
                <View key={country} style={styles.countryChip}>
                  <Text style={styles.countryText}>{country}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>Delivery zones are not published yet.</Text>
            )}
          </View>

          <Text style={styles.sectionTitle}>Reviews</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewsScroll}>
            {reviews.length === 0 ? (
              <View style={styles.reviewFallback}>
                <Text style={styles.emptyText}>No reviews yet.</Text>
              </View>
            ) : (
              reviews.slice(0, 5).map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  <Text style={styles.reviewText} numberOfLines={4}>{review.comment}</Text>
                  <View style={styles.reviewStars}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons key={star} name="star" size={14} color={star <= review.rating ? "#F4B400" : "#E0E0E0"} />
                    ))}
                  </View>
                  <View style={styles.reviewFooter}>
                    <View>
                      <Text style={styles.reviewName}>{review.userName}</Text>
                      <Text style={styles.reviewRole}>Buyer</Text>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setReportTarget({ type: "review", id: review.id, label: `Review by ${review.userName}` })}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="flag-outline" size={16} color="#B0B0B0" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <TouchableOpacity onPress={handleMessageVendor} activeOpacity={0.86} style={styles.messageButton}>
            <Text style={styles.messageButtonText}>Message Vendor</Text>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push({ pathname: "/(buyer)/explore", params: { view: "products" } } as any)}
            activeOpacity={0.86}
            style={styles.browseButton}
          >
            <Text style={styles.browseButtonText}>Browse Foodstuff</Text>
          </TouchableOpacity>

          {vendor ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setReportTarget({ type: "store", id: vendor.id, label: vendor.storeName })}
              style={styles.reportStoreBtn}
            >
              <Ionicons name="flag-outline" size={15} color="#B0B0B0" />
              <Text style={styles.reportStoreText}>Report this store</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>

      <ReportModal
        visible={!!reportTarget}
        onClose={() => setReportTarget(null)}
        targetType={reportTarget?.type ?? "store"}
        targetId={reportTarget?.id ?? ""}
        targetLabel={reportTarget?.label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F6F5F1" },
  stateScreen: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, backgroundColor: "#F6F5F1" },
  stateTitle: { color: "#2B2B2B", fontSize: 18, fontFamily: "Manrope-Bold", marginTop: 12 },
  stateButton: { marginTop: 18, height: 50, paddingHorizontal: 24, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  stateButtonText: { color: "#FFFFFF", fontSize: 15, fontFamily: "Manrope-Bold" },
  hero: { height: 290, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, overflow: "hidden", backgroundColor: "#173B31" },
  heroImage: { width: "100%", height: "100%" },
  heroOverlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.34)" },
  heroSafe: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 8 },
  heroButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  heroCopy: { position: "absolute", left: 24, right: 24, bottom: 26 },
  storeName: { color: "#FFFFFF", fontSize: 30, lineHeight: 34, fontFamily: "Manrope-ExtraBold" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  ratingText: { color: "rgba(255,255,255,0.88)", fontSize: 15, fontFamily: "Outfit-Regular" },
  scrollContent: { paddingBottom: 20 },
  card: { marginTop: -18, marginHorizontal: 16, borderRadius: 32, backgroundColor: "#FFFFFF", paddingHorizontal: 18, paddingTop: 22, paddingBottom: 24 },
  sectionTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 18, marginBottom: 12 },
  storeDesc: { fontSize: 14, lineHeight: 22, fontFamily: "Outfit-Regular", color: "#687076" },
  infoStrip: { borderRadius: 20, backgroundColor: "#F4F8F6", padding: 14, marginTop: 16 },
  infoBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoBadgeText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  infoStripText: { fontSize: 12, lineHeight: 18, fontFamily: "Outfit-Regular", color: "#5E6965", marginTop: 8 },
  productsScroll: { gap: 12 },
  productCard: { width: 170, borderRadius: 22, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EEF0F1", padding: 12 },
  productImage: { width: "100%", height: 126, backgroundColor: "#F0E6D4" },
  productName: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 12 },
  productPrice: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 4 },
  addButton: { marginTop: 12, height: 40, borderRadius: 12, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  addButtonText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  countryRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  countryChip: { borderRadius: 999, backgroundColor: "#F3F4F4", paddingHorizontal: 16, paddingVertical: 10 },
  countryText: { fontSize: 13, fontFamily: "Outfit-Medium", color: "#282828" },
  reviewsScroll: { gap: 12 },
  reviewFallback: { borderRadius: 18, backgroundColor: "#F6F7F7", padding: 16 },
  reviewCard: { width: 230, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EEF0F1", padding: 14 },
  reviewText: { fontSize: 13, lineHeight: 20, fontFamily: "Outfit-Regular", color: "#282828", minHeight: 80 },
  reviewStars: { flexDirection: "row", gap: 3, marginTop: 12 },
  reviewName: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#282828" },
  reviewRole: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#9AA3A0", marginTop: 2 },
  heartBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585" },
  messageButton: { marginTop: 22, height: 54, borderRadius: 16, backgroundColor: "#1A2E24", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  messageButtonText: { fontSize: 15, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  browseButton: { marginTop: 12, height: 54, borderRadius: 16, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  browseButtonText: { fontSize: 15, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  reviewFooter: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 12 },
  reportStoreBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 20, paddingVertical: 10 },
  reportStoreText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#B0B0B0" },
});
