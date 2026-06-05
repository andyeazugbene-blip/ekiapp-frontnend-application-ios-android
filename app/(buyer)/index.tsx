import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { productService } from "../../services/productService";
import { useCartStore } from "../../stores/cartStore";
import { useAuthStore } from "../../stores/authStore";
import { type Product } from "../../types/product";
import { type VendorSummary } from "../../types/vendor";
import { RemoteImage } from "../../components/ui/RemoteImage";
import { vendorService } from "../../services/vendorService";

const CURRENCY_SYMBOL: Record<string, string> = {
  GBP: "\u00A3",
  USD: "$",
  EUR: "\u20AC",
  NGN: "\u20A6",
};

const SCREEN_WIDTH = Dimensions.get("window").width;
const DEAL_CARD_WIDTH = Math.min(SCREEN_WIDTH - 96, 280);

type HomeDeal = {
  id: string;
  colors: readonly [string, string];
  badge: string;
  title: string;
  highlight: string;
  body: string;
  cta: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

function rankProducts(products: Product[], vendors: VendorSummary[]): Product[] {
  const vendorMap = new Map(vendors.map((vendor) => [vendor.id, vendor]));
  const now = Date.now();

  return [...products].sort((left, right) => {
    const leftVendor = vendorMap.get(left.vendorId);
    const rightVendor = vendorMap.get(right.vendorId);

    const leftAgeDays = Math.max(1, (now - Date.parse(left.createdAt || new Date().toISOString())) / 86400000);
    const rightAgeDays = Math.max(1, (now - Date.parse(right.createdAt || new Date().toISOString())) / 86400000);

    const leftScore =
      (leftVendor?.totalOrders ?? 0) * 5 +
      (leftVendor?.rating ?? 0) * 20 +
      Math.min(left.stock, 50) * 0.7 +
      (left.images?.[0] ? 12 : 0) +
      Math.max(0, 30 - leftAgeDays);

    const rightScore =
      (rightVendor?.totalOrders ?? 0) * 5 +
      (rightVendor?.rating ?? 0) * 20 +
      Math.min(right.stock, 50) * 0.7 +
      (right.images?.[0] ? 12 : 0) +
      Math.max(0, 30 - rightAgeDays);

    if (rightScore !== leftScore) return rightScore - leftScore;
    return Date.parse(right.createdAt) - Date.parse(left.createdAt);
  });
}

function rankVendors(vendors: VendorSummary[], products: Product[]): VendorSummary[] {
  const productCountMap = products.reduce<Map<string, number>>((map, product) => {
    map.set(product.vendorId, (map.get(product.vendorId) ?? 0) + 1);
    return map;
  }, new Map());

  return [...vendors].sort((left, right) => {
    const leftScore =
      (left.totalOrders ?? 0) * 5 +
      (left.rating ?? 0) * 20 +
      (productCountMap.get(left.id) ?? left.totalProducts ?? 0) * 4 +
      (left.verificationStatus === "verified" ? 10 : 0);
    const rightScore =
      (right.totalOrders ?? 0) * 5 +
      (right.rating ?? 0) * 20 +
      (productCountMap.get(right.id) ?? right.totalProducts ?? 0) * 4 +
      (right.verificationStatus === "verified" ? 10 : 0);

    if (rightScore !== leftScore) return rightScore - leftScore;
    return Date.parse(right.joinedAt) - Date.parse(left.joinedAt);
  });
}

export default function BuyerHomeScreen() {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const user = useAuthStore((s) => s.user);
  const deliveryCountry = user && "country" in user ? user.country : undefined;

  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDealIndex, setActiveDealIndex] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prods, vendorList] = await Promise.all([
        productService.getAll({ limit: 24 }).catch(() => [] as Product[]),
        vendorService.getAllVendors({ search: "", status: "active" }).catch(() => [] as VendorSummary[]),
      ]);
      setProducts((prods ?? []).filter(Boolean));
      setVendors(rankVendors(vendorList ?? [], prods ?? []).slice(0, 6));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const activeProducts = useMemo(
    () => products.filter((product) => product && product.status === "active"),
    [products],
  );

  const categoryItems = useMemo(() => {
    const seen = new Set<string>();
    return activeProducts
      .filter((product) => product.images?.[0])
      .filter((product) => {
        const key = (product.category || product.name).trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 6);
  }, [activeProducts]);

  const bestSellers = useMemo(() => rankProducts(activeProducts, vendors).slice(0, 6), [activeProducts, vendors]);
  const featuredProduct = activeProducts[0];
  const firstCurrency = featuredProduct?.currency ?? "GBP";
  const firstSymbol = CURRENCY_SYMBOL[firstCurrency] ?? "\u00A3";

  const hotDeals = useMemo<HomeDeal[]>(() => {
    const deals: HomeDeal[] = [
      {
        id: "wallet-credit",
        colors: ["#F33D4D", "#D9253A"],
        badge: "Limited Time",
        title: `Order ${firstSymbol}50+ get`,
        highlight: `${firstSymbol}2 Wallet Credit`,
        body: "Auto-applied at checkout",
        cta: "Get Reward",
        icon: "flash",
        onPress: () => router.push("/(buyer)/wallet" as any),
      },
      {
        id: "referral",
        colors: ["#0A6E59", "#69C893"],
        badge: "Referral",
        title: "Invite a friend",
        highlight: `Get ${firstSymbol}5 each`,
        body: "Share your referral link and earn wallet credit",
        cta: "Invite Now",
        icon: "people",
        onPress: () => router.push("/(buyer)/wallet" as any),
      },
    ];

    if (featuredProduct) {
      deals.push({
        id: `product-${featuredProduct.id}`,
        colors: ["#E59A00", "#F4C01B"],
        badge: "Fresh Pick",
        title: featuredProduct.name,
        highlight: `${CURRENCY_SYMBOL[featuredProduct.currency] ?? "\u00A3"}${featuredProduct.price.toFixed(2)}`,
        body: featuredProduct.description?.trim() || "Now available to order from the buyer marketplace.",
        cta: "View Product",
        icon: "cube",
        onPress: () =>
          router.push({ pathname: "/(buyer)/product-detail", params: { id: featuredProduct.id } } as any),
      });
    }

    return deals;
  }, [featuredProduct, firstSymbol, router]);

  const openSearch = (value = "") => {
    const trimmed = value.trim();
    router.push({ pathname: "/(buyer)/explore", params: trimmed ? { search: trimmed } : {} } as any);
  };

  const handleAddToCart = (item: Product) => {
    addItem(item, 1).catch((err) => {
      Alert.alert("Cart not updated", err instanceof Error ? err.message : "Could not add this item to your cart.");
    });
  };

  const handleOpenVendor = (vendorId: string) => {
    router.push({ pathname: "/(buyer)/vendor-detail", params: { id: vendorId } } as any);
  };

  const onDealsMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const cardSpan = DEAL_CARD_WIDTH + 14;
    const nextIndex = Math.round(offsetX / cardSpan);
    setActiveDealIndex(Math.max(0, Math.min(nextIndex, hotDeals.length - 1)));
  };

  const avatarInitial = (user?.name ?? "E").trim().charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerWrap}>
          <LinearGradient colors={["#0B7658", "#0A6C52"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerCard}>
            <View style={styles.headerTop}>
              <View style={styles.deliveryBadge}>
                <View style={styles.deliveryIconCircle}>
                  <Ionicons name="location" size={20} color="#076B51" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.deliveryTitle}>Delivery</Text>
                  <Text style={styles.deliverySubtitle} numberOfLines={1}>
                    {deliveryCountry || "Choose your delivery country"}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => router.push("/(buyer)/profile" as any)}
                activeOpacity={0.86}
                style={styles.avatarButton}
              >
                {user?.avatar ? (
                  <RemoteImage uri={user.avatar} style={styles.avatarImage} borderRadius={28} fallbackIcon="person" />
                ) : (
                  <Text style={styles.avatarInitial}>{avatarInitial}</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => openSearch()} activeOpacity={0.9} style={styles.searchShell}>
              <Ionicons name="search-outline" size={20} color="#9AA3A0" />
              <Text style={styles.searchPlaceholder}>Search for foodstuff</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Hot Deals</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={DEAL_CARD_WIDTH + 14}
            decelerationRate="fast"
            contentContainerStyle={styles.dealsScroll}
            onMomentumScrollEnd={onDealsMomentumEnd}
          >
            {hotDeals.map((deal) => (
              <LinearGradient key={deal.id} colors={[...deal.colors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.dealCard}>
                <View style={styles.dealTopRow}>
                  <View style={styles.dealBadge}>
                    <Text style={styles.dealBadgeText}>{deal.badge}</Text>
                  </View>
                  <View style={styles.dealIconBubble}>
                    <Ionicons name={deal.icon} size={18} color="#FFFFFF" />
                  </View>
                </View>
                <Text style={styles.dealTitle}>{deal.title}</Text>
                <Text style={styles.dealHighlight}>{deal.highlight}</Text>
                <Text style={styles.dealBody}>{deal.body}</Text>
                <TouchableOpacity onPress={deal.onPress} activeOpacity={0.86} style={styles.dealButton}>
                  <Text style={styles.dealButtonText}>{deal.cta}</Text>
                </TouchableOpacity>
              </LinearGradient>
            ))}
          </ScrollView>

          <View style={styles.dotsRow}>
            {hotDeals.map((deal, index) => (
              <View key={deal.id} style={[styles.dot, index === activeDealIndex && styles.dotActive]} />
            ))}
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Popular foodstuff</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            {categoryItems.map((product) => (
              <TouchableOpacity
                key={product.id}
                onPress={() =>
                  router.push({
                    pathname: "/(buyer)/explore",
                    params: { category: product.category || product.name },
                  } as any)
                }
                activeOpacity={0.86}
                style={styles.categoryItem}
              >
                <RemoteImage uri={product.images?.[0]} style={styles.categoryImage} borderRadius={34} />
                <Text style={styles.categoryLabel} numberOfLines={1}>
                  {(product.category || product.name).split(" ")[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <View style={styles.loaderBlock}>
            <ActivityIndicator color="#076B51" />
          </View>
        ) : null}

        {vendors.length > 0 ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>New vendors</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vendorsScroll}>
              {vendors.map((vendor) => (
                <TouchableOpacity
                  key={vendor.id}
                  onPress={() => handleOpenVendor(vendor.id)}
                  activeOpacity={0.86}
                  style={styles.vendorCard}
                >
                  <View style={styles.vendorImageWrap}>
                    <RemoteImage uri={vendor.coverImage} style={styles.vendorImage} borderRadius={16} />
                    <View style={styles.ratingPill}>
                      <Ionicons name="star" size={12} color="#F4B400" />
                      <Text style={styles.ratingPillText}>
                        {vendor.rating > 0 ? `${vendor.rating.toFixed(1)} (${Math.max(vendor.totalOrders, 0)})` : "New store"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.newVendorTag}>
                    <Text style={styles.newVendorTagText}>New Vendor</Text>
                  </View>
                  <Text style={styles.vendorName}>{vendor.storeName}</Text>
                  <Text style={styles.vendorMeta} numberOfLines={1}>
                    {vendor.description || `${vendor.city || vendor.country} foodstuff`}
                  </Text>
                  <View style={styles.vendorCta}>
                    <Text style={styles.vendorCtaText}>View Details</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {bestSellers.length > 0 ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Best Sellers</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bestSellerScroll}>
              {bestSellers.map((product) => {
                const symbol = CURRENCY_SYMBOL[product.currency] ?? "\u00A3";
                return (
                  <TouchableOpacity
                    key={product.id}
                    onPress={() => router.push({ pathname: "/(buyer)/product-detail", params: { id: product.id } } as any)}
                    activeOpacity={0.86}
                    style={styles.bestCard}
                  >
                    <View style={styles.bestImageWrap}>
                      <RemoteImage uri={product.images?.[0]} style={styles.bestImage} borderRadius={18} />
                      <TouchableOpacity
                        onPress={() => handleOpenVendor(product.vendorId)}
                        activeOpacity={0.86}
                        style={styles.heartButton}
                      >
                        <Ionicons name="storefront-outline" size={18} color="#4A6A5E" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.bestName} numberOfLines={1}>
                      {product.name}
                    </Text>
                    <Text style={styles.bestPrice}>{symbol}{product.price.toFixed(2)}</Text>
                    <TouchableOpacity onPress={() => handleAddToCart(product)} activeOpacity={0.86} style={styles.addToCartButton}>
                      <Text style={styles.addToCartText}>Add to cart</Text>
                      <Ionicons name="cart-outline" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {vendors.length > 0 ? (
          <View style={styles.supportSection}>
            <View style={styles.supportHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.supportTitle}>Support new vendors</Text>
                <Text style={styles.supportSubtitle}>Discover new stores and help them get their first order</Text>
              </View>
              <View style={styles.supportIcon}>
                <Ionicons name="thumbs-up" size={18} color="#FFFFFF" />
              </View>
            </View>

            {vendors.slice(0, 2).map((vendor) => (
              <TouchableOpacity
                key={vendor.id}
                onPress={() => handleOpenVendor(vendor.id)}
                activeOpacity={0.86}
                style={styles.supportStoreRow}
              >
                <RemoteImage uri={vendor.coverImage || vendor.avatar} style={styles.supportStoreImage} borderRadius={12} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.supportStoreName}>{vendor.storeName}</Text>
                  <Text style={styles.supportStoreMeta} numberOfLines={1}>
                    {vendor.description || "Authentic African ingredients"}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}

            <TouchableOpacity onPress={() => router.push("/(buyer)/explore" as any)} activeOpacity={0.86} style={styles.supportButton}>
              <Text style={styles.supportButtonText}>Support new vendors</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!loading && activeProducts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="storefront-outline" size={34} color="#9AA3A0" />
            <Text style={styles.emptyTitle}>No foodstuff available yet</Text>
            <Text style={styles.emptyText}>Fresh products will appear here as soon as vendors publish them.</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F6F5F1" },
  scrollContent: { paddingBottom: 108 },
  headerWrap: { paddingHorizontal: 16, paddingTop: 8 },
  headerCard: {
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  deliveryBadge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  deliveryIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  deliveryTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Manrope-Bold",
  },
  deliverySubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontFamily: "Outfit-Regular",
    marginTop: 4,
  },
  avatarButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.22)",
  },
  avatarImage: {
    width: 56,
    height: 56,
  },
  avatarInitial: {
    fontSize: 18,
    fontFamily: "Manrope-ExtraBold",
    color: "#076B51",
  },
  searchShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 58,
    marginTop: 18,
  },
  searchPlaceholder: {
    flex: 1,
    color: "#9AA3A0",
    fontSize: 14,
    fontFamily: "Outfit-Regular",
  },
  sectionBlock: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: "Manrope-Bold",
    color: "#2B2B2B",
    marginBottom: 14,
    paddingHorizontal: 16,
  },
  dealsScroll: {
    paddingHorizontal: 16,
    gap: 14,
  },
  dealCard: {
    width: DEAL_CARD_WIDTH,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  dealTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dealBadge: {
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dealBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Outfit-Medium",
  },
  dealIconBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  dealTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    lineHeight: 24,
    fontFamily: "Outfit-Medium",
    marginTop: 18,
  },
  dealHighlight: {
    color: "#FFFFFF",
    fontSize: 20,
    lineHeight: 28,
    fontFamily: "Manrope-ExtraBold",
    marginTop: 4,
  },
  dealBody: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Outfit-Regular",
    marginTop: 4,
    minHeight: 38,
  },
  dealButton: {
    marginTop: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  dealButtonText: {
    color: "#2B2B2B",
    fontSize: 15,
    fontFamily: "Manrope-Bold",
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
  },
  dot: {
    width: 28,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E3E3E3",
  },
  dotActive: {
    backgroundColor: "#0A6C52",
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 14,
  },
  categoryItem: {
    width: 72,
    alignItems: "center",
  },
  categoryImage: {
    width: 68,
    height: 68,
    marginBottom: 8,
    backgroundColor: "#E8E6DF",
  },
  categoryLabel: {
    color: "#3A3A3A",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Outfit-Medium",
    textAlign: "center",
  },
  loaderBlock: {
    paddingVertical: 28,
    alignItems: "center",
  },
  vendorsScroll: {
    paddingHorizontal: 16,
    gap: 14,
  },
  vendorCard: {
    width: 214,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 12,
  },
  vendorImageWrap: {
    position: "relative",
  },
  vendorImage: {
    width: "100%",
    height: 150,
    backgroundColor: "#E7E3D8",
  },
  ratingPill: {
    position: "absolute",
    left: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  ratingPillText: {
    color: "#2B2B2B",
    fontSize: 12,
    fontFamily: "Manrope-Bold",
  },
  newVendorTag: {
    alignSelf: "flex-start",
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: "#D6552F",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  newVendorTagText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Manrope-Bold",
  },
  vendorName: {
    color: "#2B2B2B",
    fontSize: 18,
    lineHeight: 24,
    fontFamily: "Manrope-Bold",
    marginTop: 12,
  },
  vendorMeta: {
    color: "#727272",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-Regular",
    marginTop: 6,
    minHeight: 18,
  },
  vendorCta: {
    marginTop: 16,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#0A6C52",
    alignItems: "center",
    justifyContent: "center",
  },
  vendorCtaText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Manrope-Bold",
  },
  bestSellerScroll: {
    paddingHorizontal: 16,
    gap: 14,
  },
  bestCard: {
    width: Math.min(SCREEN_WIDTH * 0.48, 190),
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 12,
  },
  bestImageWrap: {
    position: "relative",
  },
  bestImage: {
    width: "100%",
    height: 155,
    backgroundColor: "#E8E5DC",
  },
  heartButton: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F4FBF7",
    alignItems: "center",
    justifyContent: "center",
  },
  bestName: {
    color: "#2B2B2B",
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "Manrope-Bold",
    marginTop: 12,
  },
  bestPrice: {
    color: "#2B2B2B",
    fontSize: 18,
    lineHeight: 24,
    fontFamily: "Manrope-Bold",
    marginTop: 4,
  },
  addToCartButton: {
    marginTop: 14,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#0A6C52",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  addToCartText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Manrope-Bold",
  },
  supportSection: {
    marginHorizontal: 16,
    marginTop: 28,
    borderRadius: 28,
    backgroundColor: "#173B31",
    padding: 16,
  },
  supportHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  supportTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    lineHeight: 24,
    fontFamily: "Manrope-Bold",
  },
  supportSubtitle: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Outfit-Regular",
    marginTop: 6,
  },
  supportIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  supportStoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    padding: 10,
    marginBottom: 10,
  },
  supportStoreImage: {
    width: 58,
    height: 58,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  supportStoreName: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "Manrope-Bold",
  },
  supportStoreMeta: {
    color: "rgba(255,255,255,0.74)",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-Regular",
    marginTop: 4,
  },
  supportButton: {
    marginTop: 10,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  supportButtonText: {
    color: "#2B2B2B",
    fontSize: 16,
    fontFamily: "Manrope-Bold",
  },
  emptyState: {
    marginHorizontal: 16,
    marginTop: 28,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 28,
    alignItems: "center",
  },
  emptyTitle: {
    color: "#2B2B2B",
    fontSize: 18,
    lineHeight: 24,
    fontFamily: "Manrope-Bold",
    marginTop: 12,
  },
  emptyText: {
    color: "#727272",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Outfit-Regular",
    textAlign: "center",
    marginTop: 8,
  },
});
