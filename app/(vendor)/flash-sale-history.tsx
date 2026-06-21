import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { marketingService, type FlashSale } from "../../services/marketingService";
import { productService } from "../../services/productService";
import type { Product } from "../../types/product";
import { goBackOrReplace } from "../../utils/navigation";

function getStatus(sale: FlashSale) {
  const now = Date.now();
  const start = sale.startsAt ? Date.parse(sale.startsAt) : 0;
  const end = sale.endsAt ? Date.parse(sale.endsAt) : 0;

  if (start && Number.isFinite(start) && start > now) {
    return { label: "Scheduled", tone: "scheduled" as const };
  }
  if (end && Number.isFinite(end) && end < now) {
    return { label: "Expired", tone: "expired" as const };
  }
  return { label: "Active", tone: "active" as const };
}

export default function FlashSaleHistoryScreen() {
  const router = useRouter();
  const [sales, setSales] = useState<FlashSale[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    let active = true;
    setLoading(true);
    setError("");

    Promise.all([
      marketingService.listFlashSales(),
      productService.getMyVendorProducts().catch(() => [] as Product[]),
    ])
      .then(([nextSales, nextProducts]) => {
        if (!active) return;
        const byId = nextProducts.reduce<Record<string, Product>>((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {});
        setProducts(byId);
        setSales(
          [...nextSales].sort(
            (a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || ""),
          ),
        );
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not load flash sales.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  useFocusEffect(refresh);

  const enriched = useMemo(
    () =>
      sales.map((s) => ({
        ...s,
        productName: products[s.productId]?.name ?? "Unknown product",
        status: getStatus(s),
      })),
    [sales, products],
  );

  const handleDelete = (sale: FlashSale) => {
    Alert.alert("Delete Flash Sale", "Remove this flash sale? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await marketingService.deleteDiscount(sale.id);
            setSales((prev) => prev.filter((s) => s.id !== sale.id));
          } catch (err) {
            Alert.alert("Error", err instanceof Error ? err.message : "Could not delete flash sale.");
          }
        },
      },
    ]);
  };

  const handleShare = async (sale: FlashSale) => {
    if (sale.shareUrl) {
      await Share.share({ message: sale.shareUrl });
    }
  };

  const handleCopy = async (url: string) => {
    await Clipboard.setStringAsync(url);
    Alert.alert("Copied", "Flash sale link copied.");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => goBackOrReplace(router, "/(vendor)" as any)}
          activeOpacity={0.85}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={20} color="#202124" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Flash Sales</Text>
          <Text style={styles.headerSubtitle}>Manage your flash sale promotions</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/(vendor)/create-flash-sale" as any)}
          activeOpacity={0.85}
          style={styles.createButton}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.stateScreen}>
          <ActivityIndicator color="#076B51" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {enriched.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="flash-outline" size={28} color="#076B51" />
              <Text style={styles.emptyTitle}>No flash sales yet</Text>
              <Text style={styles.emptyBody}>
                Create a flash sale to offer time-limited discounts on your products.
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(vendor)/create-flash-sale" as any)}
                activeOpacity={0.85}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Create Flash Sale</Text>
              </TouchableOpacity>
            </View>
          ) : (
            enriched.map((sale) => (
              <View key={sale.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{sale.productName}</Text>
                    <Text style={styles.cardMeta}>
                      {sale.startsAt ? new Date(sale.startsAt).toLocaleDateString() : "Now"}
                      {" — "}
                      {sale.endsAt ? new Date(sale.endsAt).toLocaleDateString() : "No end"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      sale.status.tone === "expired"
                        ? styles.statusPillExpired
                        : sale.status.tone === "scheduled"
                          ? styles.statusPillScheduled
                          : styles.statusPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        sale.status.tone === "expired"
                          ? styles.statusPillTextExpired
                          : sale.status.tone === "scheduled"
                            ? styles.statusPillTextScheduled
                            : styles.statusPillTextActive,
                      ]}
                    >
                      {sale.status.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={16} color="#076B51" />
                  <Text style={styles.detailText}>
                    Created {new Date(sale.createdAt).toLocaleDateString()}
                  </Text>
                </View>

                <View style={styles.actionRow}>
                  {sale.shareUrl ? (
                    <>
                      <TouchableOpacity
                        onPress={() => handleCopy(sale.shareUrl!)}
                        activeOpacity={0.85}
                        style={styles.secondaryButton}
                      >
                        <Ionicons name="copy-outline" size={16} color="#076B51" />
                        <Text style={styles.secondaryButtonText}>Copy</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleShare(sale)}
                        activeOpacity={0.85}
                        style={styles.actionButton}
                      >
                        <Ionicons name="share-social-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Share</Text>
                      </TouchableOpacity>
                    </>
                  ) : null}
                  <TouchableOpacity
                    onPress={() => handleDelete(sale)}
                    activeOpacity={0.85}
                    style={styles.deleteButton}
                  >
                    <Ionicons name="trash-outline" size={16} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8F7" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7ECEA",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: 22, fontFamily: "Manrope-Bold", color: "#202124" },
  headerSubtitle: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#687076", marginTop: 4 },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
  },
  stateScreen: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 16, paddingBottom: 28 },
  errorText: {
    color: "#DC2626",
    fontSize: 13,
    fontFamily: "Outfit-Regular",
    textAlign: "center",
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E7ECEA",
    padding: 24,
    alignItems: "center",
    marginTop: 24,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#202124", marginTop: 12 },
  emptyBody: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Outfit-Regular",
    color: "#687076",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 18,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E7ECEA",
    padding: 18,
    marginBottom: 14,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#202124" },
  cardMeta: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#687076", marginTop: 4 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusPillActive: { backgroundColor: "#EAF7F1" },
  statusPillScheduled: { backgroundColor: "#FFF4E5" },
  statusPillExpired: { backgroundColor: "#FDECEC" },
  statusPillText: { fontSize: 11, fontFamily: "Manrope-SemiBold" },
  statusPillTextActive: { color: "#076B51" },
  statusPillTextScheduled: { color: "#B45309" },
  statusPillTextExpired: { color: "#DC2626" },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 12 },
  detailText: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: "Outfit-Regular", color: "#48505A" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  primaryButton: {
    minWidth: 180,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Manrope-SemiBold" },
  secondaryButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DCE5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryButtonText: { color: "#076B51", fontSize: 13, fontFamily: "Manrope-SemiBold" },
  actionButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  actionButtonText: { color: "#FFFFFF", fontSize: 13, fontFamily: "Manrope-SemiBold" },
  deleteButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDECEC",
    backgroundColor: "#FFF5F5",
    alignItems: "center",
    justifyContent: "center",
  },
});
