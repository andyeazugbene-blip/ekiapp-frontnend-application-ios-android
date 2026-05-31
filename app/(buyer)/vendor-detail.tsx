import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { vendorService } from "../../services/vendorService";
import { productService } from "../../services/productService";
import { reviewService } from "../../services/reviewService";
import { deliveryService, type DeliveryZone } from "../../services/deliveryService";
import { useCartStore } from "../../stores/cartStore";
import type { VendorSummary } from "../../types/vendor";
import type { Product, Review } from "../../types/product";
import { RemoteImage } from "../../components/ui/RemoteImage";
import { openConversationThread } from "../../utils/messaging";

const CURRENCY_SYMBOL: Record<string, string> = {
  GBP: "\u00A3",
  USD: "$",
  EUR: "\u20AC",
  NGN: "\u20A6",
  CAD: "C$",
};

export default function VendorDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const addItem = useCartStore((state) => state.addItem);

  const [vendor, setVendor] = useState<VendorSummary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let cancelled = false;
      setLoading(true);

      Promise.all([
        vendorService.getVendorById(id),
        productService.getAll({ vendorId: id, limit: 10 }),
        reviewService.getForVendor(id),
        deliveryService.listAllZones().catch(() => [] as DeliveryZone[]),
      ])
        .then(([nextVendor, nextProducts, nextReviews, nextZones]) => {
          if (cancelled) return;
          setVendor(nextVendor);
          setProducts(nextProducts ?? []);
          setReviews(nextReviews ?? []);
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
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.86} style={styles.stateButton}>
          <Text style={styles.stateButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const deliveryCountries = zones.length > 0
    ? Array.from(new Set(zones.filter((zone) => zone.active).map((zone) => zone.country).filter(Boolean)))
    : [vendor.country].filter(Boolean);

  const handleAddToCart = (product: Product) => {
    addItem(product, 1).catch((err) => {
      Alert.alert("Cart not updated", err instanceof Error ? err.message : "Could not add this item to your cart.");
    });
  };

  const handleMessageVendor = () => {
    openConversationThread({ participantId: vendor.id })
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
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.86} style={styles.heroButton}>
            <Ionicons name="arrow-back" size={22} color="#0A6C52" />
          </TouchableOpacity>
        </SafeAreaView>
        <View style={styles.heroCopy}>
          <Text style={styles.storeName}>{vendor.storeName}</Text>
          <View style={styles.ratingRow}>
            <Text style={styles.ratingText}>{vendor.rating?.toFixed(1) ?? "4.8"} ({reviews.length || vendor.totalOrders} reviews)</Text>
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

          <View style={styles.infoStrip}>
            <View style={styles.infoBadge}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#076B51" />
              <Text style={styles.infoBadgeText}>Verified vendor</Text>
            </View>
            <Text style={styles.infoStripText}>Message the vendor directly and keep everything on Eki.</Text>
          </View>

          <Text style={styles.sectionTitle}>Available foodstuff</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productsScroll}>
            {products.map((product) => {
              const symbol = CURRENCY_SYMBOL[product.currency] ?? "\u00A3";
              return (
                <TouchableOpacity
                  key={product.id}
                  onPress={() => router.push({ pathname: "/(buyer)/product-detail", params: { id: product.id } } as any)}
                  activeOpacity={0.86}
                  style={styles.productCard}
                >
                  <RemoteImage uri={product.images?.[0]} style={styles.productImage} borderRadius={18} fallbackIcon="cube-outline" />
                  <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                  <Text style={styles.productPrice}>{symbol}{product.price.toFixed(2)}</Text>
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
                  <Text style={styles.reviewName}>{review.userName}</Text>
                </View>
              ))
            )}
          </ScrollView>

          <TouchableOpacity onPress={handleMessageVendor} activeOpacity={0.86} style={styles.messageButton}>
            <Text style={styles.messageButtonText}>Message Vendor</Text>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/(buyer)/explore" as any)} activeOpacity={0.86} style={styles.browseButton}>
            <Text style={styles.browseButtonText}>Browse Foodstuff</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.34)" },
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
  reviewName: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 12 },
  emptyText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585" },
  messageButton: { marginTop: 22, height: 54, borderRadius: 16, backgroundColor: "#1A2E24", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  messageButtonText: { fontSize: 15, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  browseButton: { marginTop: 12, height: 54, borderRadius: 16, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  browseButtonText: { fontSize: 15, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
});
