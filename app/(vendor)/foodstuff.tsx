import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { productService } from "../../services/productService";
import { useAuthStore } from "../../stores/authStore";
import { useInventoryStore } from "../../stores/inventoryStore";
import { Product, ProductStatus } from "../../types/product";
import { RemoteImage } from "../../components/ui/RemoteImage";

type TabKey = "All" | "Active" | "Low Stock" | "Draft";

const TABS: TabKey[] = ["All", "Active", "Low Stock", "Draft"];

const STATUS_LABEL: Record<ProductStatus, string> = {
  active: "Active",
  low_stock: "Low Stock",
  out_of_stock: "Out of stock",
  draft: "Draft",
};

const CURRENCY_SYMBOL: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  NGN: "₦",
};

export default function FoodstuffScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const vendor = user?.role === "vendor" ? user : null;
  const setSelectedProduct = useInventoryStore((s) => s.setSelectedProduct);

  const [activeTab, setActiveTab] = useState<TabKey>("All");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!vendor) return;
    setLoading(true);
    setError("");
    try {
      const list = await productService.getMyVendorProducts();
      setProducts(list ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load foodstuff.");
    } finally {
      setLoading(false);
    }
  }, [vendor]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = products
    .filter((p) => {
      if (activeTab === "All") return true;
      if (activeTab === "Active") return p.status === "active";
      if (activeTab === "Low Stock") return p.status === "low_stock" || p.stock <= 5;
      if (activeTab === "Draft") return p.status === "draft";
      return true;
    })
    .filter((p) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });

  const handleOpen = (product: Product) => {
    setSelectedProduct(product);
    router.push({ pathname: "/(vendor)/foodstuff-detail", params: { id: product.id } } as any);
  };

  const handleAdd = () => router.push("/(vendor)/foodstuff-add" as any);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitleInline}>Your foodstuff</Text>
          <TouchableOpacity onPress={handleAdd} activeOpacity={0.85} style={styles.addButtonSmall}>
            <Ionicons name="add" size={20} color="#076B51" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs — fixed above the list so categories stay usable while scrolling */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {TABS.map((tab) => (
            <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} activeOpacity={0.85} style={[styles.tab, activeTab === tab && styles.tabActive]}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#858585" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search foodstuff"
            placeholderTextColor="#858585"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* States */}
        {loading && (
          <View style={styles.placeholder}>
            <ActivityIndicator color="#076B51" />
          </View>
        )}

        {!loading && error ? <Text style={styles.errorText}>{error}</Text> : null}

        {!loading && !error && filtered.length === 0 ? (
          <Text style={styles.emptyText}>
            {products.length === 0
              ? "No foodstuff yet. Tap “Add Foodstuff” to create your first listing."
              : "No items match this filter."}
          </Text>
        ) : null}

        {/* Product list */}
        {!loading && filtered.map((product) => {
          const symbol = CURRENCY_SYMBOL[product.currency] ?? "£";
          const status = product.status === "active" && product.stock <= 5 ? "low_stock" : product.status;
          const hasMissingInfo = !product.weight || product.weight <= 0;

          return (
            <TouchableOpacity
              key={product.id}
              onPress={() => handleOpen(product)}
              activeOpacity={0.85}
              style={[styles.productCard, hasMissingInfo && styles.productCardWithWarning]}
            >
              <View style={styles.productRow}>
                <View style={styles.productImage}>
                  <RemoteImage uri={product.images?.[0]} style={styles.productImageInner} />
                </View>

                <View style={styles.productInfo}>
                  <View style={styles.productTop}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                      <Text style={styles.productCategory} numberOfLines={1}>{product.category}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        status === "low_stock" && styles.statusLowStock,
                        status === "draft" && styles.statusDraft,
                        status === "out_of_stock" && styles.statusDraft,
                        hasMissingInfo && styles.statusDraft,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          status === "low_stock" && styles.statusTextLowStock,
                          (status === "draft" || status === "out_of_stock" || hasMissingInfo) && styles.statusTextDraft,
                        ]}
                      >
                        {hasMissingInfo ? "Draft" : STATUS_LABEL[status]}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.productBottom}>
                    <View style={styles.stockBadge}>
                      <Text style={styles.stockText}>Stock: {product.stock}</Text>
                    </View>
                    <Text style={styles.productPrice}>{symbol}{product.price.toFixed(2)}</Text>
                  </View>
                </View>
              </View>

              {hasMissingInfo && (
                <View style={styles.warningBanner}>
                  <Ionicons name="warning-outline" size={16} color="#856B0E" />
                  <Text style={styles.warningBannerText}>
                    Set delivery and add weight before buyers can order this foodstuff
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedProduct(product);
                      router.push({ pathname: "/(vendor)/foodstuff-edit", params: { id: product.id } } as any);
                    }}
                    activeOpacity={0.8}
                    style={styles.fixButton}
                  >
                    <Text style={styles.fixButtonText}>Fix Missing Info</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: { backgroundColor: "#076B51", paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  headerTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerTitleInline: { flex: 1, fontSize: 20, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  addButtonSmall: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 100 },
  tabContainer: { paddingTop: 4, marginBottom: 2, backgroundColor: "#F4F4F4" },
  tabRow: { flexDirection: "row", gap: 8, paddingVertical: 2, paddingHorizontal: 16 },
  tab: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E8E8E8" },
  tabActive: { backgroundColor: "#076B51", borderColor: "#076B51" },
  tabText: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#858585" },
  tabTextActive: { color: "#FFFFFF", fontFamily: "Manrope-SemiBold" },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, height: 40, paddingHorizontal: 14, gap: 10, marginBottom: 6, borderWidth: 1, borderColor: "#E8E8E8" },
  searchInput: { flex: 1, fontSize: 14, color: "#282828" },
  placeholder: { paddingVertical: 30, alignItems: "center" },
  emptyText: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", paddingVertical: 30 },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", marginBottom: 16, textAlign: "center" },
  productCard: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 14, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  productCardWithWarning: { borderColor: "#FFF3CD", borderWidth: 1 },
  productRow: { flexDirection: "row", alignItems: "center" },
  warningBanner: {
    marginTop: 12,
    backgroundColor: "#FFF9E6",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  warningBannerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Outfit-Medium",
    color: "#856B0E",
    lineHeight: 16,
  },
  fixButton: {
    backgroundColor: "#076B51",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  fixButtonText: {
    fontSize: 11,
    fontFamily: "Manrope-Bold",
    color: "#FFFFFF",
  },
  productImage: { width: 80, height: 80, borderRadius: 14, backgroundColor: "#F4F4F4", marginRight: 14, overflow: "hidden" },
  productImageInner: { flex: 1, width: "100%", height: "100%", borderRadius: 14, backgroundColor: "#E8E8E8" },
  productInfo: { flex: 1 },
  productTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  productName: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828" },
  productCategory: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },
  statusBadge: { backgroundColor: "rgba(7,107,81,0.1)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  statusLowStock: { backgroundColor: "rgba(251,99,99,0.1)" },
  statusDraft: { backgroundColor: "#F4F4F4" },
  statusText: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#076B51" },
  statusTextLowStock: { color: "#FB6363" },
  statusTextDraft: { color: "#858585" },
  productBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  stockBadge: { backgroundColor: "#F4F4F4", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  stockText: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#282828" },
  productPrice: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828" },
});
