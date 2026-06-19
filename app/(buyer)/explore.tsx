import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Dimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { productService } from "../../services/productService";
import { vendorService } from "../../services/vendorService";
import { useCartStore } from "../../stores/cartStore";
import { useCurrencyStore } from "../../stores/currencyStore";
import { Product } from "../../types/product";
import { VendorSummary } from "../../types/vendor";
import { RemoteImage } from "../../components/ui/RemoteImage";
import { CurrencySelector } from "../../components/ui/CurrencySelector";
import { formatDisplayMoney } from "../../utils/currency";
import { goBackOrReplace } from "../../utils/navigation";

const SCREEN_WIDTH = Dimensions.get("window").width;
const GRID_PRODUCT_WIDTH = Math.floor((SCREEN_WIDTH - 42) / 2);
const HORIZ_CARD_WIDTH = 150;
type ExploreView = "all" | "products" | "vendors";

export default function ExploreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ search?: string; category?: string; view?: string; sort?: string }>();
  const addItem = useCartStore((s) => s.addItem);
  const selectedCurrency = useCurrencyStore((s) => s.selectedCurrency);
  const ensureCurrency = useCurrencyStore((s) => s.ensureCurrency);
  const setSelectedCurrency = useCurrencyStore((s) => s.setSelectedCurrency);
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(params.search ?? "");
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(params.category ?? null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);
  const addedAnim = useRef(new Animated.Value(0)).current;
  const activeView: ExploreView =
    params.view === "products" || params.view === "vendors" ? params.view : "all";
  const showProducts = activeView !== "vendors";
  const showVendors = activeView !== "products";
  const title =
    activeView === "products" ? "All foodstuff" : activeView === "vendors" ? "All vendors" : "Browse foodstuff";

  const loadData = useCallback(async (query?: string) => {
    setLoading(true);
    const [prods, vends] = await Promise.all([
      productService.getAll().catch(() => [] as Product[]),
      vendorService.getAllVendors({ status: "active", search: query || undefined, sort: params.sort || "newest", limit: 200 }).catch(() => [] as VendorSummary[]),
    ]);
    setProducts(prods ?? []);
    setVendors(vends ?? []);
    setLoading(false);
  }, [params.sort]);

  useFocusEffect(
    useCallback(() => {
      loadData((params.search ?? "").trim());
    }, [loadData, params.search])
  );

  useEffect(() => {
    setSearch(params.search ?? "");
  }, [params.search]);

  useEffect(() => {
    if (params.category) setSelectedCategory(params.category);
  }, [params.category]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const firstCurrency = products[0]?.currency;
    ensureCurrency(firstCurrency).catch(() => undefined);
  }, [ensureCurrency, products]);

  const handleSearch = (text: string) => {
    setSearch(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => loadData(text.trim()), 250);
  };

  const handleAddToCart = (product: Product) => {
    setRecentlyAddedId(product.id);
    Animated.sequence([
      Animated.timing(addedAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(addedAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setRecentlyAddedId(null));
    addItem(product, 1).catch((err) => {
      Alert.alert("Cart not updated", err instanceof Error ? err.message : "Could not add this item to your cart.");
    });
  };

  const openView = (view: ExploreView, sort?: string) => {
    const trimmed = search.trim();
    router.push({
      pathname: "/(buyer)/explore",
      params: {
        view,
        ...(sort ? { sort } : {}),
        ...(trimmed ? { search: trimmed } : {}),
      },
    } as any);
  };

  const handleOpenVendor = (vendorId: string) => {
    router.push({ pathname: "/(buyer)/vendor-detail", params: { id: vendorId } } as any);
  };

  const normalizedSearch = search.trim().toLowerCase();

  const filteredProducts = useMemo(
    () =>
      (products ?? []).filter((product) => {
        if (!product || product.status !== "active") return false;
        if (selectedCategory && product.category?.toLowerCase() !== selectedCategory.toLowerCase()) return false;
        if (!normalizedSearch) return true;
        const haystack = [product.name, product.category, product.description, product.vendorName, product.vendorCity]
          .filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(normalizedSearch);
      }),
    [normalizedSearch, products, selectedCategory],
  );

  const filteredVendors = useMemo(
    () =>
      (vendors ?? []).filter((vendor) => {
        if (!normalizedSearch) return true;
        const haystack = [vendor.storeName, vendor.description, vendor.city, vendor.country]
          .filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(normalizedSearch);
      }),
    [normalizedSearch, vendors],
  );

  // Derived sections for "all" discovery view
  const popularProducts = useMemo(() => filteredProducts.slice(0, 8), [filteredProducts]);
  const newProducts = useMemo(
    () => [...filteredProducts].sort((a, b) => Date.parse(b.createdAt || "0") - Date.parse(a.createdAt || "0")).slice(0, 8),
    [filteredProducts],
  );
  const newVendors = useMemo(() => filteredVendors.slice(0, 6), [filteredVendors]);
  const bestVendors = useMemo(
    () => [...filteredVendors].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 6),
    [filteredVendors],
  );

  // Category chips for "products" view
  const categories = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const p of products) {
      const cat = p.category?.trim();
      if (cat && p.status === "active" && !seen.has(cat.toLowerCase())) {
        seen.add(cat.toLowerCase());
        result.push(cat);
      }
    }
    return result.slice(0, 12);
  }, [products]);

  const isEmpty =
    (showProducts ? filteredProducts.length === 0 : true) &&
    (showVendors ? filteredVendors.length === 0 : true);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <TouchableOpacity onPress={() => setCurrencyOpen(true)} activeOpacity={0.85} style={styles.currencyButton}>
          <Text style={styles.currencyButtonText}>{selectedCurrency}</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="#858585" />
        <TextInput
          autoFocus={activeView === "all"}
          style={styles.searchInput}
          placeholder="Search for foodstuff"
          placeholderTextColor="#858585"
          value={search}
          onChangeText={handleSearch}
          returnKeyType="search"
        />
        {search.length > 0 ? (
          <TouchableOpacity onPress={() => { setSearch(""); loadData(""); }} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={18} color="#858585" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* View toggle for "all" */}
      {activeView === "all" && !normalizedSearch ? null : null}

      {/* Category chips — only in "products" view */}
      {activeView === "products" && categories.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          <TouchableOpacity
            onPress={() => setSelectedCategory(null)}
            activeOpacity={0.8}
            style={[styles.chip, !selectedCategory && styles.chipActive]}
          >
            <Text style={[styles.chipText, !selectedCategory && styles.chipTextActive]}>All</Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              activeOpacity={0.8}
              style={[styles.chip, selectedCategory === cat && styles.chipActive]}
            >
              <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator color="#076B51" />
          </View>
        ) : isEmpty ? (
          <View style={styles.centerBlock}>
            <Ionicons name="search-outline" size={48} color="#858585" />
            <Text style={styles.emptyTitle}>No results found</Text>
            <Text style={styles.emptyBody}>Try a different search term.</Text>
          </View>
        ) : (
          <>
            {/* ── ALL VIEW: discovery sections ───────────────────────── */}
            {activeView === "all" && (
              <>
                {/* Popular foodstuff */}
                {popularProducts.length > 0 && (
                  <>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>Popular foodstuff</Text>
                      <TouchableOpacity onPress={() => openView("products")} activeOpacity={0.7}>
                        <Text style={styles.viewAll}>View All</Text>
                      </TouchableOpacity>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizScroll}>
                      {popularProducts.map((product) => (
                        <HorizProductCard
                          key={product.id}
                          product={product}
                          selectedCurrency={selectedCurrency}
                          recentlyAddedId={recentlyAddedId}
                          onOpen={() => router.push({ pathname: "/(buyer)/product-detail", params: { id: product.id } } as any)}
                          onAdd={() => handleAddToCart(product)}
                        />
                      ))}
                    </ScrollView>
                  </>
                )}

                {/* New Products */}
                {newProducts.length > 0 && (
                  <>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>New Products</Text>
                      <TouchableOpacity onPress={() => openView("products")} activeOpacity={0.7}>
                        <Text style={styles.viewAll}>View All</Text>
                      </TouchableOpacity>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizScroll}>
                      {newProducts.map((product) => (
                        <HorizProductCard
                          key={product.id}
                          product={product}
                          selectedCurrency={selectedCurrency}
                          recentlyAddedId={recentlyAddedId}
                          onOpen={() => router.push({ pathname: "/(buyer)/product-detail", params: { id: product.id } } as any)}
                          onAdd={() => handleAddToCart(product)}
                        />
                      ))}
                    </ScrollView>
                  </>
                )}

                {/* Vendors */}
                {newVendors.length > 0 && (
                  <>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>Vendors</Text>
                      <TouchableOpacity onPress={() => openView("vendors")} activeOpacity={0.7}>
                        <Text style={styles.viewAll}>View All</Text>
                      </TouchableOpacity>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizScroll}>
                      {newVendors.map((vendor) => (
                        <HorizVendorCard
                          key={vendor.id}
                          vendor={vendor}
                          onPress={() => handleOpenVendor(vendor.id)}
                        />
                      ))}
                    </ScrollView>
                  </>
                )}

                {/* Best Vendors */}
                {bestVendors.length > 0 && (
                  <>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>Best Vendors</Text>
                      <TouchableOpacity onPress={() => openView("vendors", "best")} activeOpacity={0.7}>
                        <Text style={styles.viewAll}>View All</Text>
                      </TouchableOpacity>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizScroll}>
                      {bestVendors.map((vendor) => (
                        <HorizVendorCard
                          key={vendor.id}
                          vendor={vendor}
                          onPress={() => handleOpenVendor(vendor.id)}
                        />
                      ))}
                    </ScrollView>
                  </>
                )}

                {/* Promo banner */}
                <LinearGradient colors={["#076B51", "#4DB89A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.promoBanner}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.promoTitle}>20% OFF</Text>
                    <Text style={styles.promoSub}>On all palm oil orders</Text>
                  </View>
                  <View style={styles.promoIcon}>
                    <Ionicons name="flash" size={18} color="#FFFFFF" />
                  </View>
                </LinearGradient>

                {/* Support new vendors */}
                {newVendors.length > 0 && (
                  <View style={styles.supportCard}>
                    <View style={styles.supportHeader}>
                      <View>
                        <Text style={styles.supportTitle}>Support new vendors</Text>
                        <Text style={styles.supportSub}>Discover new stores and help{"\n"}them get their first order</Text>
                      </View>
                      <Ionicons name="heart" size={20} color="rgba(255,255,255,0.2)" />
                    </View>
                    <View style={styles.supportChips}>
                      {newVendors.slice(0, 2).map((v, i) => (
                        <TouchableOpacity
                          key={v.id}
                          onPress={() => handleOpenVendor(v.id)}
                          activeOpacity={0.85}
                          style={styles.supportChip}
                        >
                          <Text style={styles.supportChipText}>{i + 1}. {v.storeName}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity onPress={() => openView("vendors")} activeOpacity={0.85} style={styles.supportBtn}>
                      <Text style={styles.supportBtnText}>Support new vendors</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            {/* ── PRODUCTS VIEW: grid with category chips ─────────────── */}
            {activeView === "products" && filteredProducts.length > 0 && (
              <>
                <Text style={styles.sectionTitlePadded}>All available foodstuff</Text>
                <View style={styles.productGrid}>
                  {filteredProducts.map((product) => (
                    <ProductResultCard
                      key={product.id}
                      product={product}
                      selectedCurrency={selectedCurrency}
                      recentlyAddedId={recentlyAddedId}
                      onOpen={() => router.push({ pathname: "/(buyer)/product-detail", params: { id: product.id } } as any)}
                      onOpenVendor={() => handleOpenVendor(product.vendorId)}
                      onAdd={() => handleAddToCart(product)}
                    />
                  ))}
                </View>
              </>
            )}

            {/* ── VENDORS VIEW: full list ──────────────────────────────── */}
            {activeView === "vendors" && filteredVendors.length > 0 && (
              <>
                <Text style={styles.sectionTitlePadded}>All vendors</Text>
                {filteredVendors.map((vendor) => (
                  <VendorResultRow
                    key={vendor.id}
                    vendor={vendor}
                    onPress={() => handleOpenVendor(vendor.id)}
                  />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      <CurrencySelector
        selectedCurrency={selectedCurrency}
        onChange={setSelectedCurrency}
        visible={currencyOpen}
        onClose={() => setCurrencyOpen(false)}
      />
    </SafeAreaView>
  );
}

// ── Horizontal product card (for discovery sections) ─────────────────────────

function HorizProductCard({
  product,
  selectedCurrency,
  recentlyAddedId,
  onOpen,
  onAdd,
}: {
  product: Product;
  selectedCurrency: string;
  recentlyAddedId: string | null;
  onOpen: () => void;
  onAdd: () => void;
}) {
  const justAdded = recentlyAddedId === product.id;
  return (
    <TouchableOpacity onPress={onOpen} activeOpacity={0.85} style={styles.horizProductCard}>
      <View style={styles.horizProductImage}>
        {product.images?.[0] ? (
          <RemoteImage uri={product.images[0]} style={{ width: "100%", height: "100%" }} />
        ) : null}
      </View>
      <Text style={styles.horizProductName} numberOfLines={1}>{product.name ?? "Product"}</Text>
      <Text style={styles.horizProductPrice}>{formatDisplayMoney(product.price ?? 0, product.currency, selectedCurrency)}</Text>
      <TouchableOpacity onPress={onAdd} activeOpacity={0.85} style={[styles.addCartBtn, justAdded && { backgroundColor: "#076B51" }]}>
        <Text style={[styles.addCartText, justAdded && { color: "#FFFFFF" }]}>{justAdded ? "Added!" : "Add to cart"}</Text>
        <Ionicons name={justAdded ? "checkmark-circle" : "cart-outline"} size={12} color={justAdded ? "#FFFFFF" : "#076B51"} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ── Horizontal vendor card (for discovery sections) ───────────────────────────

function HorizVendorCard({ vendor, onPress }: { vendor: VendorSummary; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.horizVendorCard}>
      <View style={styles.horizVendorImageWrap}>
        <RemoteImage uri={vendor.coverImage ?? vendor.avatar} style={{ width: "100%", height: "100%" }} borderRadius={12} />
        {vendor.rating > 0 ? (
          <View style={styles.horizVendorRating}>
            <Ionicons name="star" size={10} color="#F4B400" />
            <Text style={styles.horizVendorRatingText}>{vendor.rating.toFixed(1)}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.horizVendorName} numberOfLines={1}>{vendor.storeName}</Text>
      <Text style={styles.horizVendorDesc} numberOfLines={1}>{vendor.description || `${vendor.city || vendor.country} foodstuff`}</Text>
    </TouchableOpacity>
  );
}

// ── Grid product card (for "products" view) ───────────────────────────────────

function ProductResultCard({
  product,
  selectedCurrency,
  recentlyAddedId,
  onOpen,
  onOpenVendor,
  onAdd,
}: {
  product: Product;
  selectedCurrency: string;
  recentlyAddedId: string | null;
  onOpen: () => void;
  onOpenVendor: () => void;
  onAdd: () => void;
}) {
  const justAdded = recentlyAddedId === product.id;
  return (
    <TouchableOpacity onPress={onOpen} activeOpacity={0.85} style={[styles.productCard, styles.productGridCard]}>
      <View style={styles.productImage}>
        {product.images?.[0] ? (
          <RemoteImage uri={product.images[0]} style={{ width: "100%", height: "100%" }} />
        ) : null}
        <TouchableOpacity onPress={onOpenVendor} activeOpacity={0.85} style={styles.productHeart}>
          <Ionicons name="storefront-outline" size={14} color="#076B51" />
        </TouchableOpacity>
      </View>
      <Text style={styles.productName} numberOfLines={1}>{product.name ?? "Product"}</Text>
      <Text style={styles.productPrice}>{formatDisplayMoney(product.price ?? 0, product.currency, selectedCurrency)}</Text>
      <TouchableOpacity onPress={onAdd} activeOpacity={0.85} style={[styles.addCartBtn, justAdded && { backgroundColor: "#076B51" }]}>
        <Text style={[styles.addCartText, justAdded && { color: "#FFFFFF" }]}>{justAdded ? "Added!" : "Add to cart"}</Text>
        <Ionicons name={justAdded ? "checkmark-circle" : "cart-outline"} size={12} color={justAdded ? "#FFFFFF" : "#076B51"} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ── Vendor list row (for "vendors" view) ──────────────────────────────────────

function VendorResultRow({ vendor, onPress }: { vendor: VendorSummary; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.vendorRow}>
      <View style={styles.vendorAvatar}>
        {vendor.avatar ? (
          <RemoteImage uri={vendor.avatar} style={{ width: 44, height: 44, borderRadius: 22 }} />
        ) : (
          <Ionicons name="storefront-outline" size={20} color="#858585" />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.vendorName}>{vendor.storeName ?? "Store"}</Text>
        <Text style={styles.vendorDesc} numberOfLines={1}>{vendor.description || "Authentic Nigerian Ingredients"}</Text>
      </View>
      <View style={styles.vendorArrow}>
        <Ionicons name="arrow-up" size={14} color="#076B51" style={{ transform: [{ rotate: "45deg" }] }} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Manrope-Bold", color: "#282828" },
  currencyButton: { minWidth: 56, height: 38, borderRadius: 19, backgroundColor: "#EAF5F0", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  currencyButtonText: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#076B51" },
  searchBar: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, backgroundColor: "#FFFFFF", borderRadius: 12, height: 44, paddingHorizontal: 12, gap: 8, borderWidth: 1, borderColor: "#EEEEEE", marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 13, fontFamily: "Outfit-Regular", color: "#282828" },
  // Category chips
  chipsScroll: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  chip: { height: 32, borderRadius: 16, backgroundColor: "#F4F4F4", paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: "#076B51" },
  chipText: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#282828" },
  chipTextActive: { color: "#FFFFFF" },
  // Scroll content
  scrollContent: { paddingBottom: 100 },
  centerBlock: { paddingVertical: 60, alignItems: "center", paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 16 },
  emptyBody: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 6, textAlign: "center" },
  // Section headers
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 10, marginTop: 20 },
  sectionTitle: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828" },
  sectionTitlePadded: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828", paddingHorizontal: 16, marginBottom: 10, marginTop: 16 },
  viewAll: { fontSize: 13, fontFamily: "Outfit-Medium", color: "#076B51" },
  // Horizontal product card
  horizScroll: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  horizProductCard: { width: HORIZ_CARD_WIDTH, backgroundColor: "#FFFFFF", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "#F0F0F0" },
  horizProductImage: { width: "100%", height: 130, backgroundColor: "#F0E6D4" },
  horizProductName: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#282828", paddingHorizontal: 10, paddingTop: 8 },
  horizProductPrice: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828", paddingHorizontal: 10, marginTop: 2 },
  // Horizontal vendor card
  horizVendorCard: { width: 160, backgroundColor: "#FFFFFF", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "#F0F0F0", paddingBottom: 10 },
  horizVendorImageWrap: { width: "100%", height: 100, backgroundColor: "#E8EFE9", position: "relative" },
  horizVendorRating: { position: "absolute", bottom: 6, left: 6, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  horizVendorRatingText: { fontSize: 11, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  horizVendorName: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#282828", paddingHorizontal: 10, paddingTop: 8 },
  horizVendorDesc: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#858585", paddingHorizontal: 10, marginTop: 2 },
  // Grid product card
  productGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 16, marginBottom: 10 },
  productCard: { width: 150, backgroundColor: "#FFFFFF", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "#F0F0F0" },
  productGridCard: { width: GRID_PRODUCT_WIDTH },
  productImage: { width: "100%", height: 160, backgroundColor: "#F0E6D4" },
  productHeart: { position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  productName: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#282828", paddingHorizontal: 10, paddingTop: 8 },
  productPrice: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828", paddingHorizontal: 10, marginTop: 2 },
  addCartBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginHorizontal: 8, marginTop: 8, marginBottom: 10, height: 28, borderRadius: 8, borderWidth: 1, borderColor: "#076B51" },
  addCartText: { fontSize: 10, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  // Vendor list row
  vendorRow: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, backgroundColor: "#FFFFFF", borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#F0F0F0" },
  vendorAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  vendorName: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  vendorDesc: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },
  vendorArrow: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: "#F0F0F0", alignItems: "center", justifyContent: "center" },
  // Promo
  promoBanner: { marginHorizontal: 16, marginTop: 20, borderRadius: 16, padding: 18, flexDirection: "row", alignItems: "center" },
  promoTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  promoSub: { fontSize: 12, fontFamily: "Outfit-Regular", color: "rgba(255,255,255,0.8)", marginTop: 2 },
  promoIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  // Support
  supportCard: { marginHorizontal: 16, backgroundColor: "#1A2E24", borderRadius: 18, padding: 16, marginTop: 20, marginBottom: 20 },
  supportHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  supportTitle: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  supportSub: { fontSize: 11, fontFamily: "Outfit-Regular", color: "rgba(255,255,255,0.6)", marginTop: 3 },
  supportChips: { flexDirection: "row", gap: 8, marginBottom: 12 },
  supportChip: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  supportChipText: { fontSize: 11, fontFamily: "Outfit-Medium", color: "#FFFFFF" },
  supportBtn: { height: 36, borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  supportBtnText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
});
