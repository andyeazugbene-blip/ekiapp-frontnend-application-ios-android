import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
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
import { rewardService, type Reward } from "../../services/rewardService";
import { giftCardService, type GiftCard } from "../../services/giftCardService";
import { campaignService, campaignColors, type Campaign } from "../../services/campaignService";
import { useCartStore } from "../../stores/cartStore";
import { useCurrencyStore } from "../../stores/currencyStore";
import { useAuthStore } from "../../stores/authStore";
import { type Product } from "../../types/product";
import { type VendorSummary } from "../../types/vendor";
import { RemoteImage } from "../../components/ui/RemoteImage";
import { vendorService } from "../../services/vendorService";
import { formatDisplayMoney } from "../../utils/currency";

const SCREEN_WIDTH = Dimensions.get("window").width;
const DEAL_CARD_WIDTH = Math.min(SCREEN_WIDTH - 96, 280);
const GIFT_CARD_WIDTH = 150;

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
  const selectedCurrency = useCurrencyStore((s) => s.selectedCurrency);
  const ensureCurrency = useCurrencyStore((s) => s.ensureCurrency);
  const user = useAuthStore((s) => s.user);
  const deliveryCountry = user && "country" in user ? user.country : undefined;

  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [campaignsError, setCampaignsError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeDealIndex, setActiveDealIndex] = useState(0);

  const loadCampaigns = useCallback(async () => {
    setCampaignsLoading(true);
    setCampaignsError("");
    try {
      const myCampaigns = await campaignService.getMyCampaigns();
      setCampaigns(myCampaigns);
    } catch (err) {
      setCampaignsError(err instanceof Error ? err.message : "Could not load campaigns.");
      setCampaigns([]);
    } finally {
      setCampaignsLoading(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prods, vendorList, activeRewards, activeGiftCards] = await Promise.all([
        productService.getAll({ limit: 24 }).catch(() => [] as Product[]),
        vendorService.getAllVendors({ search: "", status: "active" }).catch(() => [] as VendorSummary[]),
        rewardService.getActiveRewards().catch(() => [] as Reward[]),
        giftCardService.getActive().catch(() => [] as GiftCard[]),
      ]);
      setProducts((prods ?? []).filter(Boolean));
      setVendors(rankVendors(vendorList ?? [], prods ?? []).slice(0, 6));
      setRewards(activeRewards ?? []);
      setGiftCards(activeGiftCards ?? []);
    } finally {
      setLoading(false);
    }
    void loadCampaigns();
  }, [loadCampaigns]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const activeProducts = useMemo(
    () => products.filter((product) => product && product.status === "active"),
    [products],
  );

  const userCurrency =
    user && typeof user === "object" && "currency" in user && typeof user.currency === "string"
      ? user.currency
      : undefined;

  React.useEffect(() => {
    ensureCurrency(activeProducts[0]?.currency ?? userCurrency).catch(() => undefined);
  }, [activeProducts, ensureCurrency, userCurrency]);

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
  const giftRewards = useMemo(() => rewards.filter((reward) => !reward.isHotDeal), [rewards]);

  const hotDealCampaigns = useMemo(
    () => campaignService.getHotDeals(campaigns).slice(0, 6),
    [campaigns],
  );

  const giftCardCampaigns = useMemo(
    () => campaignService.getGiftCardCampaigns(campaigns).slice(0, 6),
    [campaigns],
  );

  const hotDeals = useMemo<HomeDeal[]>(
    () =>
      hotDealCampaigns.map((campaign) => ({
        id: `hot-deal-${campaign.id}`,
        colors: campaignColors(campaign) as unknown as readonly [string, string],
        badge: "Limited Time",
        title: campaign.title,
        highlight: campaign.subtitle || "",
        body: campaign.subtitle?.trim() || "Limited-time marketplace deal from Eki.",
        cta: "Get Reward",
        icon: "flash",
        onPress: () => {
          router.push({ pathname: "/(buyer)/explore", params: { view: "products" } } as any);
        },
      })),
    [hotDealCampaigns, router],
  );

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
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#076B51" colors={["#076B51"]} />}>
        <View style={styles.headerWrap}>
          <LinearGradient colors={["#0B7658", "#0A6C52"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerCard}>
            <View style={styles.headerTop}>
              <View style={styles.deliveryBadge}>
                <View style={styles.deliveryIconCircle}>
                  <Ionicons name="location" size={20} color="#076B51" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.deliveryTitle}>🍕 Delivery</Text>
                  <Text style={styles.deliverySubtitle} numberOfLines={1}>
                    {deliveryCountry || "Set your country"}
                  </Text>
                </View>
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity
                  onPress={() => router.push("/(buyer)/profile" as any)}
                  activeOpacity={0.86}
                  style={styles.avatarButton}
                >
                  {user?.avatar ? (
                    <RemoteImage uri={user.avatar} style={styles.avatarImage} borderRadius={20} fallbackIcon="person" />
                  ) : (
                    <Text style={styles.avatarInitial}>{avatarInitial}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.searchRow}>
              <TouchableOpacity onPress={() => openSearch()} activeOpacity={0.9} style={styles.searchShell}>
                <Ionicons name="search-outline" size={20} color="#9AA3A0" />
                <Text style={styles.searchPlaceholder}>Search for foodstuff</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {campaignsLoading ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Hot Deals</Text>
            <View style={styles.loaderBlock}>
              <ActivityIndicator color="#076B51" />
            </View>
          </View>
        ) : campaignsError ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Hot Deals</Text>
            <View style={styles.emptyState}>
              <Ionicons name="alert-circle-outline" size={28} color="#D6552F" />
              <Text style={styles.emptyTitle}>Couldn't load deals</Text>
              <Text style={styles.emptyText}>{campaignsError}</Text>
              <TouchableOpacity onPress={() => void loadCampaigns()} activeOpacity={0.86} style={styles.dealButton}>
                <Text style={styles.dealButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : hotDeals.length === 0 ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Hot Deals</Text>
            <View style={styles.emptyState}>
              <Ionicons name="flame-outline" size={28} color="#D6A700" />
              <Text style={styles.emptyTitle}>No deals right now</Text>
              <Text style={styles.emptyText}>Check back soon for hot deals and discounts!</Text>
            </View>
          </View>
        ) : (
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
                <TouchableOpacity onPress={deal.onPress} activeOpacity={0.9} style={{ flex: 1 }}>
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
                  <View style={styles.dealButton} pointerEvents="none">
                    <Text style={styles.dealButtonText}>{deal.cta}</Text>
                  </View>
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
        )}

        {giftCards.length > 0 ? (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleInline}>Gift Cards</Text>
              <TouchableOpacity onPress={() => router.push("/(buyer)/gift-cards" as any)} activeOpacity={0.8}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dealsScroll}>
              {giftCards.map((card) => (
                <TouchableOpacity
                  key={card.id}
                  onPress={() => router.push({ pathname: "/(buyer)/gift-card-detail", params: { id: card.id } } as any)}
                  activeOpacity={0.86}
                  style={styles.giftCard}
                >
                  {card.imageUrl ? (
                    <RemoteImage uri={card.imageUrl} style={styles.giftCardImage} borderRadius={12} />
                  ) : (
                    <View style={styles.giftIconWrap}>
                      <Ionicons name="gift-outline" size={24} color="#076B51" />
                    </View>
                  )}
                  <Text style={styles.giftName} numberOfLines={1}>{card.title}</Text>
                  <Text style={styles.giftValue}>{card.currency} {card.priceFormatted}</Text>
                  {card.description ? (
                    <Text style={styles.giftDesc} numberOfLines={1}>{card.description}</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {!campaignsLoading && !campaignsError && giftCardCampaigns.length > 0 ? (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleInline}>Gift Card Offers</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dealsScroll}>
              {giftCardCampaigns.map((campaign) => (
                <LinearGradient
                  key={campaign.id}
                  colors={campaignColors(campaign) as unknown as readonly [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.dealCard}
                >
                  <View style={styles.dealTopRow}>
                    <View style={styles.dealBadge}>
                      <Text style={styles.dealBadgeText}>Gift Card</Text>
                    </View>
                    <View style={styles.dealIconBubble}>
                      <Ionicons name="gift" size={18} color="#FFFFFF" />
                    </View>
                  </View>
                  <Text style={styles.dealTitle}>{campaign.title}</Text>
                  {campaign.subtitle ? <Text style={styles.dealBody}>{campaign.subtitle}</Text> : null}
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: "/(buyer)/explore", params: { view: "products" } } as any)}
                    activeOpacity={0.86}
                    style={styles.dealButton}
                  >
                    <Text style={styles.dealButtonText}>View Offer</Text>
                  </TouchableOpacity>
                </LinearGradient>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitleInline}>Popular foodstuff</Text>
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/(buyer)/explore", params: { view: "products" } } as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
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
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleInline}>New vendors</Text>
              <TouchableOpacity
                onPress={() => router.push({ pathname: "/(buyer)/explore", params: { view: "vendors", sort: "newest" } } as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.vendorsGrid}>
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
                        {vendor.rating > 0 ? `${vendor.rating.toFixed(1)} (${vendor.totalReviews ?? 0})` : "New store"}
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
            </View>
          </View>
        ) : null}

        {bestSellers.length > 0 ? (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleInline}>Best Sellers</Text>
              <TouchableOpacity
                onPress={() => router.push({ pathname: "/(buyer)/explore", params: { view: "products" } } as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.bestSellerGrid}>
              {bestSellers.map((product) => (
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
                      <Ionicons name="heart-outline" size={18} color="#4A6A5E" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.bestName} numberOfLines={1}>{product.name}</Text>
                  <Text style={styles.bestPrice}>{formatDisplayMoney(product.price, product.currency, selectedCurrency)}</Text>
                  <TouchableOpacity onPress={() => handleAddToCart(product)} activeOpacity={0.86} style={styles.addToCartButton}>
                    <Text style={styles.addToCartText}>Add to cart</Text>
                    <Ionicons name="cart-outline" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
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

            <TouchableOpacity
              onPress={() => router.push({ pathname: "/(buyer)/explore", params: { view: "vendors", sort: "newest" } } as any)}
              activeOpacity={0.86}
              style={styles.supportButton}
            >
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deliveryTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Manrope-Bold",
  },
  deliverySubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    fontFamily: "Outfit-Regular",
    marginTop: 2,
  },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarInitial: {
    fontSize: 14,
    fontFamily: "Manrope-Bold",
    color: "#FFFFFF",
  },
  avatarImage: {
    width: 40,
    height: 40,
  },
  searchShell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 58,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  sectionTitleInline: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: "Manrope-Bold",
    color: "#2B2B2B",
  },
  viewAllText: {
    color: "#076B51",
    fontSize: 13,
    fontFamily: "Manrope-Bold",
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
  vendorsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 12,
  },
  vendorCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 12,
  },
  vendorImageWrap: {
    position: "relative",
  },
  vendorImage: {
    width: "100%",
    height: 120,
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
  bestSellerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 12,
  },
  bestCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 12,
  },
  bestImageWrap: {
    position: "relative",
  },
  bestImage: {
    width: "100%",
    height: 130,
    backgroundColor: "#E8E5DC",
  },
  heartButton: {
    position: "absolute",
    right: 10,
    top: 10,
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
  giftCard: {
    width: GIFT_CARD_WIDTH,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 14,
    alignItems: "center",
    shadowColor: "#182722",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  giftCardImage: {
    width: "100%",
    height: 72,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "#E8F4ED",
  },
  giftIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(7,107,81,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  giftName: {
    color: "#2B2B2B",
    fontSize: 14,
    lineHeight: 18,
    fontFamily: "Manrope-Bold",
    textAlign: "center",
    marginBottom: 4,
  },
  giftValue: {
    color: "#076B51",
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "Manrope-ExtraBold",
    textAlign: "center",
  },
  giftDesc: {
    color: "#727272",
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "Outfit-Regular",
    textAlign: "center",
    marginTop: 4,
  },
});
