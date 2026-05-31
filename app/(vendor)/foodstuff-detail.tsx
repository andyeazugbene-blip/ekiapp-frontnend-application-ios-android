import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { formatCurrency } from "../../utils/formatters";
import { useInventoryStore } from "../../stores/inventoryStore";
import { Product, ProductStatus } from "../../types/product";
import { productService } from "../../services/productService";
import { ApiRequestError } from "../../services/api";
import { RemoteImage } from "../../components/ui/RemoteImage";

const STATUS_LABEL: Record<ProductStatus, string> = {
  active: "Active",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
  draft: "Draft",
};

export default function FoodstuffDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { selectedProduct, setSelectedProduct } = useInventoryStore();

  const [product, setProduct] = useState<Product | null>(selectedProduct);
  const [loading, setLoading] = useState(!selectedProduct);
  const [savingStock, setSavingStock] = useState(false);
  const [savingFlag, setSavingFlag] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (selectedProduct || !id) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await productService.getById(id);
        if (cancelled) return;
        setProduct(p);
        setSelectedProduct(p);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load product.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, selectedProduct, setSelectedProduct]);

  const persistStatusChange = async (next: { isPublished?: boolean; isAvailable?: boolean }) => {
    if (!product) return;
    const isPublished = next.isPublished ?? product.status !== "draft";
    const isAvailable = next.isAvailable ?? product.status !== "out_of_stock";

    let status: ProductStatus = "active";
    if (!isPublished) status = "draft";
    else if (!isAvailable) status = "out_of_stock";
    else if (product.stock <= 5) status = "low_stock";

    setSavingFlag(true);
    setError("");
    try {
      const updated = await productService.updateProduct(product.id, { status });
      const merged = { ...product, ...updated };
      setProduct(merged);
      setSelectedProduct(merged);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 403 && next.isPublished) {
        Alert.alert(
          "Verification required",
          "You need to verify your account before publishing.",
          [
            { text: "Verify now", onPress: () => router.push("/(vendor-verification)" as any) },
            { text: "Cancel", style: "cancel" },
          ]
        );
        return;
      }
      setError(err instanceof Error ? err.message : "Could not update.");
    } finally {
      setSavingFlag(false);
    }
  };

  const updateStock = async (next: number) => {
    if (!product || next < 0) return;
    setSavingStock(true);
    try {
      const updated = await productService.updateProduct(product.id, { stock: next });
      const merged = { ...product, ...updated, stock: next };
      setProduct(merged);
      setSelectedProduct(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update stock.");
    } finally {
      setSavingStock(false);
    }
  };

  const handleDelete = () => {
    if (!product) return;
    Alert.alert(
      "Delete this product?",
      `“${product.name}” will be permanently removed from your store.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await productService.deleteProduct(product.id);
              setSelectedProduct(null);
              router.back();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not delete product.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading || !product) {
    return (
      <View style={styles.page}>
        <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Foodstuff detail</Text>
            <Text style={styles.headerSubtitle}>{loading ? "Loading..." : "No product selected."}</Text>
          </View>
        </SafeAreaView>
        <View style={styles.placeholder}>{loading ? <ActivityIndicator color="#076B51" /> : null}</View>
      </View>
    );
  }

  const isPublished = product.status !== "draft";
  const isAvailable = product.status !== "out_of_stock";

  return (
    <View style={styles.page}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{product.name}</Text>
          <Text style={styles.headerSubtitle}>{product.category}</Text>
          <View style={styles.headerMeta}>
            <Text style={styles.headerPrice}>{formatCurrency(product.price)}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{STATUS_LABEL[product.status]}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() =>
              router.push({ pathname: "/(vendor)/foodstuff-edit", params: { id: product.id } } as any)
            }
            style={styles.editButton}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Photo preview */}
        <View style={styles.photoCard}>
          <RemoteImage uri={product.images?.[0]} style={styles.photo} />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Stock</Text>
            <Text style={styles.statValue}>{product.stock}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Price</Text>
            <Text style={styles.statValue}>{formatCurrency(product.price)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Listing settings</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Published</Text>
            <Switch
              value={isPublished}
              onValueChange={(v) => persistStatusChange({ isPublished: v })}
              trackColor={{ false: "#D7E4DC", true: "#076B51" }}
              thumbColor="#FFFFFF"
              disabled={savingFlag}
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Available for sale</Text>
            <Switch
              value={isAvailable}
              onValueChange={(v) => persistStatusChange({ isAvailable: v })}
              trackColor={{ false: "#D7E4DC", true: "#076B51" }}
              thumbColor="#FFFFFF"
              disabled={savingFlag}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Inventory</Text>
          <View style={styles.stockRow}>
            <View>
              <Text style={styles.toggleLabel}>Stock quantity</Text>
              <Text style={styles.bodyText}>Adjust stock as orders come in.</Text>
            </View>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                onPress={() => updateStock(product.stock - 1)}
                style={styles.stepperButton}
                disabled={savingStock || product.stock <= 0}
              >
                <Ionicons name="remove" size={16} color="#282828" />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{product.stock}</Text>
              <TouchableOpacity
                onPress={() => updateStock(product.stock + 1)}
                style={[styles.stepperButton, styles.stepperButtonActive]}
                disabled={savingStock}
              >
                <Ionicons name="add" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Product info</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Category</Text>
            <Text style={styles.infoValue}>{product.category}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Weight</Text>
            <Text style={styles.infoValue}>{product.weight ? `${product.weight}${product.unit ?? "g"}` : "Not set"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Description</Text>
            <Text style={styles.bodyText}>{product.description || "No description added."}</Text>
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity onPress={handleDelete} style={[styles.deleteButton, deleting && { opacity: 0.6 }]} disabled={deleting}>
          <Text style={styles.deleteButtonText}>{deleting ? "Deleting..." : "Delete this product"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F4F4F4" },
  headerSafeArea: { backgroundColor: "#076B51" },
  header: {
    backgroundColor: "#076B51",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  headerTitle: { fontSize: 30, fontFamily: "Manrope-Bold", lineHeight: 30, color: "#FFFFFF" },
  headerSubtitle: { fontSize: 16, fontFamily: "Outfit-Light", color: "#FFFFFF", marginTop: 6 },
  headerMeta: { flexDirection: "row", alignItems: "center", marginTop: 12, gap: 10 },
  headerPrice: { fontSize: 16, fontFamily: "Outfit-Light", color: "#FFFFFF" },
  statusBadge: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#FFFFFF" },
  editButton: {
    alignSelf: "flex-start",
    marginTop: 12,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  editButtonText: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  scrollContent: { padding: 20, paddingBottom: 40 },
  placeholder: { paddingVertical: 40, alignItems: "center" },
  photoCard: { backgroundColor: "#FFFFFF", borderRadius: 30, padding: 14, marginBottom: 20 },
  photo: { width: "100%", height: 200, borderRadius: 18 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 30, padding: 20 },
  statLabel: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#858585" },
  statValue: { fontSize: 24, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 8 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 30, padding: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 16 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  toggleLabel: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#282828" },
  bodyText: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 4 },
  stockRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepperRow: { flexDirection: "row", alignItems: "center" },
  stepperButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  stepperButtonActive: { backgroundColor: "#076B51" },
  stepperValue: { width: 44, textAlign: "center", fontSize: 22, fontFamily: "Manrope-Bold", color: "#282828" },
  infoRow: { marginBottom: 12 },
  infoLabel: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#858585" },
  infoValue: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 4 },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", marginBottom: 12, textAlign: "center" },
  deleteButton: { height: 56, borderRadius: 14, borderWidth: 1, borderColor: "#FB6363", backgroundColor: "transparent", alignItems: "center", justifyContent: "center" },
  deleteButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FB6363" },
});
