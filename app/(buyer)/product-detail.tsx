import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { productService } from "../../services/productService";
import { reviewService } from "../../services/reviewService";
import { deliveryService } from "../../services/deliveryService";
import { useCartStore } from "../../stores/cartStore";
import { useAuthStore } from "../../stores/authStore";
import { RemoteImage } from "../../components/ui/RemoteImage";
import { type Product, type Review } from "../../types/product";
import { openConversationThread } from "../../utils/messaging";

const CURRENCY_SYMBOL: Record<string, string> = {
  GBP: "\u00A3",
  USD: "$",
  EUR: "\u20AC",
  NGN: "\u20A6",
  CAD: "C$",
};

export default function ProductDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const addItem = useCartStore((s) => s.addItem);
  const buyerCountry = useAuthStore((s) => {
    const user = s.user;
    return user && "country" in user ? user.country : undefined;
  });

  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [estimatedDays, setEstimatedDays] = useState("Calculated at checkout");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      productService.getById(id).catch(() => null),
      reviewService.getForProduct(id).catch(() => [] as Review[]),
      deliveryService.listAllZones().catch(() => []),
    ]).then(([nextProduct, nextReviews, zones]) => {
      if (cancelled) return;
      setProduct(nextProduct);
      setReviews(nextReviews ?? []);

      const match = zones.find((zone) =>
        buyerCountry
          ? zone.country.toLowerCase() === buyerCountry.toLowerCase()
          : zone.countryCode === "UK",
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

  const ratingText = useMemo(() => {
    if (reviews.length === 0) return "No reviews yet";
    const average = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
    return `${average.toFixed(1)} (${reviews.length} reviews)`;
  }, [reviews]);

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
      Alert.alert("Cart not updated", err instanceof Error ? err.message : "Could not add this item to your cart.");
    } finally {
      setAdding(false);
    }
  };

  const handleMessageVendor = () => {
    if (!product) return;
    openConversationThread({ participantId: product.vendorId })
      .then(() => router.push("/(buyer)/message-chat" as any))
      .catch((err) => {
        Alert.alert("Message unavailable", err instanceof Error ? err.message : "Could not open the conversation.");
      });
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
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.86} style={styles.stateButton}>
          <Text style={styles.stateButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const symbol = CURRENCY_SYMBOL[product.currency] ?? "\u00A3";

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <RemoteImage uri={product.images?.[0]} style={styles.heroImage} borderRadius={0} fallbackIcon="cube-outline" />
        <View style={styles.heroOverlay} />

        <SafeAreaView edges={["top"]} style={styles.heroSafe}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.86} style={styles.heroButton}>
            <Ionicons name="arrow-back" size={22} color="#0A6C52" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleOpenVendorStore} activeOpacity={0.86} style={styles.heroButton}>
            <Ionicons name="storefront-outline" size={22} color="#0A6C52" />
          </TouchableOpacity>
        </SafeAreaView>

        <View style={styles.heroCopy}>
          <Text style={styles.productName}>{product.name}</Text>
          <View style={styles.heroMetaRow}>
            <Text style={styles.priceText}>{symbol}{product.price.toFixed(2)}</Text>
            <View style={styles.ratingRow}>
              <Text style={styles.ratingText}>{ratingText}</Text>
              {reviews.length > 0 ? <Ionicons name="star" size={18} color="#F4B400" /> : null}
            </View>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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

          <View style={styles.vendorCard}>
            <View style={styles.vendorMeta}>
              <Text style={styles.vendorLabel}>Sold by</Text>
              <Text style={styles.vendorName}>{product.vendorName}</Text>
              <Text style={styles.vendorLocation}>{product.vendorCity || "Vendor location unavailable"}</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/(buyer)/vendor-detail", params: { id: product.vendorId } } as any)}
              activeOpacity={0.86}
              style={styles.vendorButton}
            >
              <Text style={styles.vendorButtonText}>View Store</Text>
            </TouchableOpacity>
          </View>

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

          <View style={styles.protectionBanner}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#0A6C52" />
            <Text style={styles.protectionText}>Payment is protected until delivery is confirmed</Text>
          </View>
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
    height: 360,
    borderBottomLeftRadius: 38,
    borderBottomRightRadius: 38,
    overflow: "hidden",
    backgroundColor: "#173B31",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.36)",
  },
  heroSafe: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 34,
  },
  productName: {
    color: "#FFFFFF",
    fontSize: 28,
    lineHeight: 34,
    fontFamily: "Manrope-ExtraBold",
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 12,
  },
  priceText: {
    color: "#FFFFFF",
    fontSize: 30,
    lineHeight: 34,
    fontFamily: "Manrope-ExtraBold",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ratingText: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 15,
    fontFamily: "Outfit-Regular",
  },
  scrollContent: {
    paddingBottom: 18,
  },
  contentCard: {
    marginTop: -16,
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
  vendorCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    borderRadius: 22,
    backgroundColor: "#F4F8F6",
    padding: 16,
    marginBottom: 22,
  },
  vendorMeta: { flex: 1 },
  vendorLabel: { color: "#687076", fontSize: 12, fontFamily: "Outfit-Medium" },
  vendorName: { color: "#2B2B2B", fontSize: 16, fontFamily: "Manrope-Bold", marginTop: 4 },
  vendorLocation: { color: "#687076", fontSize: 12, fontFamily: "Outfit-Regular", marginTop: 4 },
  vendorButton: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "#0A6C52",
    alignItems: "center",
    justifyContent: "center",
  },
  vendorButtonText: { color: "#FFFFFF", fontSize: 13, fontFamily: "Manrope-Bold" },
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
  protectionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 20,
    borderRadius: 18,
    backgroundColor: "#F4F5F2",
    borderWidth: 1,
    borderColor: "#E6E7E3",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  protectionText: {
    flex: 1,
    color: "#6F7478",
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "Outfit-Regular",
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
});
