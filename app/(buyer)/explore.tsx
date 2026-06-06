import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
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

export default function ExploreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ search?: string; category?: string }>();
  const addItem = useCartStore((s) => s.addItem);
  const selectedCurrency = useCurrencyStore((s) => s.selectedCurrency);
  const ensureCurrency = useCurrencyStore((s) => s.ensureCurrency);
  const setSelectedCurrency = useCurrencyStore((s) => s.setSelectedCurrency);
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(params.search ?? "");
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async (query?: string) => {
    setLoading(true);
    const [prods, vends] = await Promise.all([
      productService.getAll({ category: params.category || undefined, limit: 80 }).catch(() => [] as Product[]),
      vendorService.getAllVendors().catch(() => [] as VendorSummary[]),
    ]);
    setProducts(prods ?? []);
    setVendors(vends ?? []);
    setLoading(false);
  }, [params.category]);

  useFocusEffect(
    useCallback(() => {
      loadData((params.search ?? "").trim());
    }, [loadData, params.search])
  );

  useEffect(() => {
    setSearch(params.search ?? "");
  }, [params.search]);

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
    addItem(product, 1).catch((err) => {
      Alert.alert("Cart not updated", err instanceof Error ? err.message : "Could not add this item to your cart.");
    });
  };

  const clearFilters = () => {
    setSearch("");
    loadData("");
  };

  const handleOpenVendor = (vendorId: string) => {
    router.push({ pathname: "/(buyer)/vendor-detail", params: { id: vendorId } } as any);
  };

  const normalizedSearch = search.trim().toLowerCase();
  const filteredProducts = useMemo(
    () =>
      (products ?? []).filter((product) => {
        if (!product || product.status !== "active") return false;
        if (!normalizedSearch) return true;
        const haystack = [
          product.name,
          product.category,
          product.description,
          product.vendorName,
          product.vendorCity,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedSearch);
      }),
    [normalizedSearch, products],
  );

  const vendorList = useMemo(
    () =>
      (vendors ?? [])
        .filter((vendor) => {
          if (!normalizedSearch) return true;
          const haystack = [
            vendor.storeName,
            vendor.description,
            vendor.city,
            vendor.country,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(normalizedSearch);
        })
        .slice(0, 5),
    [normalizedSearch, vendors],
  );

  const popular = filteredProducts.slice(0, 8);
  const bestSellers = filteredProducts.slice(0, 6);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Browse foodstuff</Text>
        <TouchableOpacity onPress={() => setCurrencyOpen(true)} activeOpacity={0.85} style={styles.currencyButton}>
          <Text style={styles.currencyButtonText}>{selectedCurrency}</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="#858585" />
        <TextInput
          autoFocus
          style={styles.searchInput}
          placeholder="Search for foodstuff"
          placeholderTextColor="#858585"
          value={search}
          onChangeText={handleSearch}
          returnKeyType="search"
        />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <ActivityIndicator color="#076B51" />
          </View>
        ) : filteredProducts.length === 0 && vendorList.length === 0 ? (
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <Ionicons name="search-outline" size={48} color="#858585" />
            <Text style={{ fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 16 }}>No products found</Text>
            <Text style={{ fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 6 }}>Try a different search term.</Text>
          </View>
        ) : (
          <>
            {/* Popular foodstuff */}
            {popular.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Popular foodstuff</Text>
                  <TouchableOpacity onPress={clearFilters} activeOpacity={0.7}>
                    <Text style={styles.viewAll}>View All</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productScroll}>
                  {popular.map((product) => {
                    return (
                      <TouchableOpacity
                        key={product.id}
                        onPress={() => router.push({ pathname: "/(buyer)/product-detail", params: { id: product.id } } as any)}
                        activeOpacity={0.85}
                        style={styles.productCard}
                      >
                        <View style={styles.productImage}>
                          {product.images?.[0] ? (
                            <RemoteImage uri={product.images[0]} style={{ width: "100%", height: "100%" }} />
                          ) : null}
                          <TouchableOpacity
                            onPress={() => handleOpenVendor(product.vendorId)}
                            activeOpacity={0.85}
                            style={styles.productHeart}
                          >
                            <Ionicons name="storefront-outline" size={14} color="#076B51" />
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.productName} numberOfLines={1}>{product.name ?? "Product"}</Text>
                        <Text style={styles.productPrice}>
                          {formatDisplayMoney(product.price ?? 0, product.currency, selectedCurrency)}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleAddToCart(product)}
                          activeOpacity={0.85}
                          style={styles.addCartBtn}
                        >
                          <Text style={styles.addCartText}>Add to cart</Text>
                          <Ionicons name="cart-outline" size={12} color="#076B51" />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {/* New vendors */}
            {vendorList.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>New vendors</Text>
                  <TouchableOpacity onPress={clearFilters} activeOpacity={0.7}>
                    <Text style={styles.viewAll}>View All</Text>
                  </TouchableOpacity>
                </View>
                {vendorList.map((vendor) => (
                  <TouchableOpacity
                    key={vendor.id}
                    onPress={() => router.push({ pathname: "/(buyer)/vendor-detail", params: { id: vendor.id } } as any)}
                    activeOpacity={0.85}
                    style={styles.vendorRow}
                  >
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
                ))}
              </>
            )}

            {/* Best Sellers */}
            {bestSellers.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Best Sellers</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productScroll}>
                  {bestSellers.map((product) => {
                    return (
                      <TouchableOpacity
                        key={product.id}
                        onPress={() => router.push({ pathname: "/(buyer)/product-detail", params: { id: product.id } } as any)}
                        activeOpacity={0.85}
                        style={styles.productCard}
                      >
                        <View style={styles.productImage}>
                          {product.images?.[0] ? (
                            <RemoteImage uri={product.images[0]} style={{ width: "100%", height: "100%" }} />
                          ) : null}
                          <TouchableOpacity
                            onPress={() => handleOpenVendor(product.vendorId)}
                            activeOpacity={0.85}
                            style={styles.productHeart}
                          >
                            <Ionicons name="storefront-outline" size={14} color="#076B51" />
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.productName} numberOfLines={1}>{product.name ?? "Product"}</Text>
                        <Text style={styles.productPrice}>
                          {formatDisplayMoney(product.price ?? 0, product.currency, selectedCurrency)}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleAddToCart(product)}
                          activeOpacity={0.85}
                          style={styles.addCartBtn}
                        >
                          <Text style={styles.addCartText}>Add to cart</Text>
                          <Ionicons name="cart-outline" size={12} color="#076B51" />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })}
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
            {vendorList.length > 0 && (
              <View style={styles.supportCard}>
                <View style={styles.supportHeader}>
                  <View>
                    <Text style={styles.supportTitle}>Support new vendors</Text>
                    <Text style={styles.supportSub}>Discover new stores and help{"\n"}them get their first order</Text>
                  </View>
                  <Ionicons name="heart" size={20} color="rgba(255,255,255,0.2)" />
                </View>
                <View style={styles.supportChips}>
                  {vendorList.slice(0, 2).map((v, i) => (
                    <TouchableOpacity
                      key={v.id}
                      onPress={() => router.push({ pathname: "/(buyer)/vendor-detail", params: { id: v.id } } as any)}
                      activeOpacity={0.85}
                      style={styles.supportChip}
                    >
                      <Text style={styles.supportChipText}>{i + 1}. {v.storeName}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  onPress={() => {
                    const firstVendor = vendorList[0];
                    if (firstVendor) {
                      router.push({ pathname: "/(buyer)/vendor-detail", params: { id: firstVendor.id } } as any);
                    }
                  }}
                  activeOpacity={0.85}
                  style={styles.supportBtn}
                >
                  <Text style={styles.supportBtnText}>Support new vendors</Text>
                </TouchableOpacity>
              </View>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Manrope-Bold", color: "#282828" },
  currencyButton: {
    minWidth: 56,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#EAF5F0",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  currencyButtonText: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#076B51" },
  searchBar: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, backgroundColor: "#FFFFFF", borderRadius: 12, height: 44, paddingHorizontal: 12, gap: 8, borderWidth: 1, borderColor: "#EEEEEE", marginBottom: 16 },
  searchInput: { flex: 1, fontSize: 13, fontFamily: "Outfit-Regular", color: "#282828" },
  scrollContent: { paddingBottom: 100 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 10, marginTop: 18 },
  sectionTitle: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828", paddingHorizontal: 16, marginBottom: 10 },
  viewAll: { fontSize: 13, fontFamily: "Outfit-Medium", color: "#076B51" },
  productScroll: { paddingHorizontal: 16, gap: 10, marginBottom: 10 },
  productCard: { width: 150, backgroundColor: "#FFFFFF", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "#F0F0F0" },
  productImage: { width: "100%", height: 110, backgroundColor: "#F0E6D4" },
  productHeart: { position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  productName: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#282828", paddingHorizontal: 10, paddingTop: 8 },
  productPrice: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828", paddingHorizontal: 10, marginTop: 2 },
  addCartBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginHorizontal: 8, marginTop: 8, marginBottom: 10, height: 28, borderRadius: 8, borderWidth: 1, borderColor: "#076B51" },
  addCartText: { fontSize: 10, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  vendorRow: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, backgroundColor: "#FFFFFF", borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#F0F0F0" },
  vendorAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  vendorName: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  vendorDesc: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },
  vendorArrow: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: "#F0F0F0", alignItems: "center", justifyContent: "center" },
  promoBanner: { marginHorizontal: 16, marginTop: 20, borderRadius: 16, padding: 18, flexDirection: "row", alignItems: "center" },
  promoTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  promoSub: { fontSize: 12, fontFamily: "Outfit-Regular", color: "rgba(255,255,255,0.8)", marginTop: 2 },
  promoIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
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

