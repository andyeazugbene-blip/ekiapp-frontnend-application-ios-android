import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { productService } from "../../services/productService";
import { reviewService } from "../../services/reviewService";
import { deliveryService } from "../../services/deliveryService";
import { matchesDeliveryZoneCountry } from "../../services/deliveryService";
import { useCartStore, CurrencyMismatchError } from "../../stores/cartStore";
import { useAuthStore } from "../../stores/authStore";
import { useCurrencyStore } from "../../stores/currencyStore";
import { useFavoritesStore } from "../../stores/favoritesStore";
import { RemoteImage } from "../../components/ui/RemoteImage";
import { type Product, type Review } from "../../types/product";
import type { ReviewsWithStats } from "../../services/reviewService";
import { openConversationThread } from "../../utils/messaging";
import { vendorService } from "../../services/vendorService";
import { goBackOrReplace } from "../../utils/navigation";
import { CurrencySelector } from "../../components/ui/CurrencySelector";
import { formatDisplayMoney } from "../../utils/currency";
import { ReportModal } from "../../components/ui/ReportModal";

export default function ProductDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const addItem = useCartStore((s) => s.addItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const buyerCountry = useAuthStore((s) => {
    const user = s.user;
    return user && "country" in user ? user.country : undefined;
  });
  const userId = useAuthStore((s) => s.user?.id);
  const selectedCurrency = useCurrencyStore((s) => s.selectedCurrency);
  const ensureCurrency = useCurrencyStore((s) => s.ensureCurrency);
  const setSelectedCurrency = useCurrencyStore((s) => s.setSelectedCurrency);

  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewStats, setReviewStats] = useState<{ averageRating: number; totalReviews: number }>({ averageRating: 0, totalReviews: 0 });
  const [estimatedDays, setEstimatedDays] = useState("Calculated at checkout");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const isFavorite = useFavoritesStore((s) => (product ? s.isFavorite(product.id) : false));
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      productService.getById(id).catch(() => null),
      reviewService.getForProduct(id).catch((): ReviewsWithStats => ({ reviews: [], averageRating: 0, totalReviews: 0 })),
      deliveryService.listAllZones().catch(() => []),
    ]).then(([nextProduct, nextReviewData, zones]) => {
      if (cancelled) return;
      setProduct(nextProduct);
      setReviews(nextReviewData.reviews);
      setReviewStats({ averageRating: nextReviewData.averageRating, totalReviews: nextReviewData.totalReviews });

      const match = zones.find((zone) =>
        buyerCountry ? matchesDeliveryZoneCountry(zone, buyerCountry) : zone.countryCode === "UK",
      );
      if (match?.estimatedDays) {
        setEstimatedDays(match.estimatedDays);
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [buyerCountry, id]);

  useEffect(() => {
    ensureCurrency(product?.currency).catch(() => undefined);
  }, [ensureCurrency, product?.currency]);


  const handleAddToCart = async () => {
    if (!product) return;
    setAdding(true);
    try {
      await addItem(product, 1);
      Alert.alert("Added to cart", `${product.name} has been added to your cart.`, [
        { text: "Continue Shopping", style: "cancel" },
        { text: "View Cart", onPress: () => router.push("/(buyer)/cart" as any) },
      ]);
    } catch (err) {
      if (err instanceof CurrencyMismatchError) {
        Alert.alert(
          "Different currency",
          `Your cart has ${err.existing} items. Replace with this ${err.incoming} product?`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Replace Cart", style: "destructive", onPress: async () => {
              try { await clearCart(); await addItem(product, 1); Alert.alert("Added to cart", `${product.name} has been added to your cart.`); }
              catch (e) { Alert.alert("Cart not updated", e instanceof Error ? e.message : "Could not add this item to your cart."); }
            }},
          ],
        );
      } else {
        Alert.alert("Cart not updated", err instanceof Error ? err.message : "Could not add this item to your cart.");
      }
    } finally {
      setAdding(false);
    }
  };

  const handleMessageVendor = () => {
    if (!product) return;
    const start = async () => {
      const vendor = await vendorService.getVendorById(product.vendorId);
      const participantId = vendor.userId ?? product.vendorUserId ?? undefined;
      if (!participantId) {
        throw new Error("This vendor profile is still syncing. Please try again in a moment.");
      }
      return openConversationThread({
        participantId,
        participantName: vendor.storeName || product.vendorName,
        participantAvatar: vendor.avatar ?? vendor.coverImage,
        participantRole: "vendor",
      });
    };
    start()
      .then(() => router.push("/(buyer)/message-chat" as any))
      .catch((err) => {
        Alert.alert("Message unavailable", err instanceof Error ? err.message : "Could not open the conversation.");
      });
  };

  const handleToggleFavorite = () => {
    if (!product) return;
    toggleFavorite(product, userId);
  };

  const handleOpenVendorStore = () => {
    if (!product?.vendorId) return;
    router.push({ pathname: "/(buyer)/vendor-detail", params: { id: product.vendorId } } as any);
  };

  if (loading) {
    return (
      <View style={styles.stateScreen}>
        <ActivityIndicator color="#076B51" />
      </View>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.stateScreen} edges={["top"]}>
        <Ionicons name="alert-circle-outline" size={42} color="#9AA3A0" />
        <Text style={styles.stateTitle}>Product not found</Text>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)" as any)} activeOpacity={0.86} style={styles.stateButton}>
          <Text style={styles.stateButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const avgRating = reviewStats.averageRating > 0
    ? reviewStats.averageRating
    : reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;
  const totalReviewCount = reviewStats.totalReviews > 0 ? reviewStats.totalReviews : reviews.length;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.floatingHeader}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)" as any)} activeOpacity={0.86} style={styles.heroButton}>
          <Ionicons name="arrow-back" size={22} color="#0A6C52" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleToggleFavorite} activeOpacity={0.86} style={styles.heroButton}>
          <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={22} color="#0A6C52" />
        </TouchableOpacity>
      </SafeAreaView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <RemoteImage uri={product.images?.[0]} style={styles.heroImage} borderRadius={0} fallbackIcon="cube-outline" />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.55)"]}
            style={styles.heroGradient}
            pointerEvents="none"
          >
            <Text style={styles.heroProductName} numberOfLines={2}>{product.name}</Text>
            <Text style={styles.heroPriceText}>{formatDisplayMoney(product.price, product.currency, selectedCurrency)}</Text>
            <View style={styles.heroRatingRow}>
              {avgRating > 0 ? (
                <>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons key={star} name="star" size={13} color={star <= Math.round(avgRating) ? "#F4B400" : "rgba(255,255,255,0.35)"} />
                  ))}
                  <Text style={styles.heroRatingText}>{avgRating.toFixed(1)} ({totalReviewCount} reviews)</Text>
                </>
              ) : (
                <Text style={styles.heroRatingText}>No reviews yet</Text>
              )}
            </View>
          </LinearGradient>
        </View>
        <View style={styles.contentCard}>
          <Text style={styles.sectionTitle}>Delivery Info</Text>
          <View style={styles.deliveryGrid}>
            <View style={styles.deliveryCard}>
              <View style={styles.deliveryIconWrap}>
                <Ionicons name="car-outline" size={24} color="#0A6C52" />
              </View>
              <Text style={styles.deliveryLabel}>Delivery to</Text>
              <Text style={styles.deliveryValue}>{buyerCountry || "Selected destination"}</Text>
            </View>

            <View style={[styles.deliveryCard, styles.deliveryCardDark]}>
              <View style={[styles.deliveryIconWrap, styles.deliveryIconWrapDark]}>
                <Ionicons name="calendar-outline" size={24} color="#FFFFFF" />
              </View>
              <Text style={[styles.deliveryLabel, styles.deliveryLabelDark]}>Est. Delivery</Text>
              <Text style={[styles.deliveryValue, styles.deliveryValueDark]}>{estimatedDays}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.descriptionText}>
            {product.description?.trim() || "No description has been added for this product yet."}
          </Text>

          <Text style={styles.sectionTitle}>Reviews</Text>
          {reviews.length === 0 ? (
            <View style={styles.reviewFallbackCard}>
              <Text style={styles.reviewFallbackText}>No reviews yet.</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewsScroll}>
              {reviews.map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  <Text style={styles.reviewComment} numberOfLines={4}>{review.comment}</Text>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons key={star} name="star" size={16} color={star <= review.rating ? "#F4B400" : "#E0E0E0"} />
                    ))}
                  </View>
                  <View style={styles.reviewerRow}>
                    <RemoteImage uri={review.userAvatar} style={styles.reviewerAvatar} borderRadius={22} fallbackIcon="person-outline" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reviewerName}>{review.userName}</Text>
                      <Text style={styles.reviewerMeta}>{new Date(review.createdAt).toLocaleDateString()}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
          <View style={styles.paymentBanner}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#076B51" />
            <Text style={styles.paymentBannerText}>Payment is protected until delivery is confirmed</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setReportVisible(true)}
            style={styles.reportProductBtn}
          >
            <Ionicons name="flag-outline" size={15} color="#B0B0B0" />
            <Text style={styles.reportProductText}>Report this product</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={styles.bottomBar}>
        <TouchableOpacity onPress={handleMessageVendor} activeOpacity={0.86} style={styles.messageButton}>
          <Ionicons name="chatbubble-ellipses-outline" size={22} color="#0A6C52" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleAddToCart}
          activeOpacity={0.86}
          disabled={adding}
          style={[styles.cartButton, adding && { opacity: 0.6 }]}
        >
          <Text style={styles.cartButtonText}>Add to Cart</Text>
          <Ionicons name="cart-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>

      <CurrencySelector
        selectedCurrency={selectedCurrency}
        onChange={setSelectedCurrency}
        visible={currencyOpen}
        onClose={() => setCurrencyOpen(false)}
      />

      <ReportModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        targetType="product"
        targetId={product?.id ?? ""}
        targetLabel={product?.name}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F6F5F1" },
  stateScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#F6F5F1",
  },
  stateTitle: {
    color: "#2B2B2B",
    fontSize: 18,
    lineHeight: 24,
    fontFamily: "Manrope-Bold",
    marginTop: 12,
  },
  stateButton: {
    marginTop: 18,
    height: 52,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: "#0A6C52",
    alignItems: "center",
    justifyContent: "center",
  },
  stateButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Manrope-Bold",
  },
  hero: {
    height: 320,
    backgroundColor: "#E8EFE9",
    overflow: "hidden",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  floatingHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  heroGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 20,
  },
  heroProductName: {
    color: "#FFFFFF",
    fontSize: 24,
    lineHeight: 30,
    fontFamily: "Manrope-ExtraBold",
    marginBottom: 4,
  },
  heroPriceText: {
    color: "#FFFFFF",
    fontSize: 22,
    lineHeight: 28,
    fontFamily: "Manrope-ExtraBold",
    marginBottom: 8,
  },
  heroRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  heroRatingText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontFamily: "Outfit-Regular",
    marginLeft: 4,
  },
  scrollContent: {
    paddingBottom: 18,
  },
  contentCard: {
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 34,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 22,
  },
  sectionTitle: {
    color: "#2B2B2B",
    fontSize: 18,
    lineHeight: 24,
    fontFamily: "Manrope-Bold",
    marginBottom: 14,
  },
  deliveryGrid: {
    flexDirection: "row",
    gap: 14,
  },
  deliveryCard: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    padding: 16,
    shadowColor: "#182722",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  deliveryCardDark: {
    backgroundColor: "#2B2B2B",
  },
  deliveryIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#EDF7F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  deliveryIconWrapDark: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  deliveryLabel: {
    color: "#84898D",
    fontSize: 15,
    fontFamily: "Outfit-Regular",
  },
  deliveryLabelDark: {
    color: "rgba(255,255,255,0.62)",
  },
  deliveryValue: {
    color: "#2B2B2B",
    fontSize: 17,
    lineHeight: 22,
    fontFamily: "Manrope-Bold",
    marginTop: 10,
  },
  deliveryValueDark: {
    color: "#FFFFFF",
  },
  descriptionText: {
    color: "#6F7478",
    fontSize: 15,
    lineHeight: 23,
    fontFamily: "Outfit-Regular",
    marginBottom: 18,
  },
  paymentBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#EDF6F2",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 18,
  },
  paymentBannerText: {
    flex: 1,
    color: "#076B51",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Outfit-Medium",
  },
  reviewFallbackCard: {
    borderRadius: 22,
    backgroundColor: "#F7F7F4",
    padding: 16,
  },
  reviewFallbackText: {
    color: "#7A7F84",
    fontSize: 14,
    fontFamily: "Outfit-Regular",
  },
  reviewsScroll: {
    gap: 14,
  },
  reviewCard: {
    width: 292,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EEF0F1",
    padding: 16,
  },
  reviewComment: {
    color: "#353535",
    fontSize: 15,
    lineHeight: 23,
    fontFamily: "Outfit-Regular",
    minHeight: 96,
  },
  starsRow: {
    flexDirection: "row",
    gap: 3,
    marginTop: 12,
  },
  reviewerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
  },
  reviewerAvatar: {
    width: 44,
    height: 44,
    backgroundColor: "#E5E5E5",
  },
  reviewerName: {
    color: "#2B2B2B",
    fontSize: 15,
    fontFamily: "Manrope-Bold",
  },
  reviewerMeta: {
    color: "#8A8F94",
    fontSize: 13,
    fontFamily: "Outfit-Regular",
    marginTop: 4,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: "#F6F5F1",
  },
  messageButton: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: "#F2F3F4",
    alignItems: "center",
    justifyContent: "center",
  },
  cartButton: {
    flex: 1,
    height: 68,
    borderRadius: 22,
    backgroundColor: "#0A6C52",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  cartButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "Manrope-Bold",
  },
  reportProductBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 16,
    paddingVertical: 10,
  },
  reportProductText: {
    fontSize: 13,
    fontFamily: "Outfit-Regular",
    color: "#B0B0B0",
  },
});
