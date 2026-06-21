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
import { marketingService, type Bundle } from "../../services/marketingService";
import { productService } from "../../services/productService";
import type { Product } from "../../types/product";
import { goBackOrReplace } from "../../utils/navigation";

export default function BundleHistoryScreen() {
  const router = useRouter();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    let active = true;
    setLoading(true);
    setError("");

    Promise.all([
      marketingService.listBundles(),
      productService.getMyVendorProducts().catch(() => [] as Product[]),
    ])
      .then(([nextBundles, nextProducts]) => {
        if (!active) return;
        const byId = nextProducts.reduce<Record<string, Product>>((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {});
        setProducts(byId);
        setBundles(
          [...nextBundles].sort(
            (a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || ""),
          ),
        );
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not load bundles.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  useFocusEffect(refresh);

  const enriched = useMemo(
    () =>
      bundles.map((b) => ({
        ...b,
        productNames: b.productIds.map((id) => products[id]?.name ?? "Unknown product"),
      })),
    [bundles, products],
  );

  const handleDelete = (bundle: Bundle) => {
    Alert.alert("Delete Bundle", "Remove this bundle? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await marketingService.deleteDiscount(bundle.id);
            setBundles((prev) => prev.filter((b) => b.id !== bundle.id));
          } catch (err) {
            Alert.alert("Error", err instanceof Error ? err.message : "Could not delete bundle.");
          }
        },
      },
    ]);
  };

  const handleShare = async (bundle: Bundle) => {
    if (bundle.shareUrl) {
      await Share.share({ message: bundle.shareUrl });
    }
  };

  const handleCopy = async (url: string) => {
    await Clipboard.setStringAsync(url);
    Alert.alert("Copied", "Bundle link copied.");
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
          <Text style={styles.headerTitle}>Bundles</Text>
          <Text style={styles.headerSubtitle}>Manage your product bundles</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/(vendor)/create-bundle" as any)}
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
              <Ionicons name="layers-outline" size={28} color="#076B51" />
              <Text style={styles.emptyTitle}>No bundles yet</Text>
              <Text style={styles.emptyBody}>
                Create a bundle to offer multiple products at a discounted price.
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(vendor)/create-bundle" as any)}
                activeOpacity={0.85}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Create Bundle</Text>
              </TouchableOpacity>
            </View>
          ) : (
            enriched.map((bundle) => (
              <View key={bundle.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{bundle.name || "Bundle"}</Text>
                    <Text style={styles.cardMeta}>
                      {bundle.productIds.length} product{bundle.productIds.length !== 1 ? "s" : ""}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="cube-outline" size={16} color="#076B51" />
                  <Text style={styles.detailText} numberOfLines={2}>
                    {bundle.productNames.join(", ")}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={16} color="#076B51" />
                  <Text style={styles.detailText}>
                    Created {new Date(bundle.createdAt).toLocaleDateString()}
                  </Text>
                </View>

                <View style={styles.actionRow}>
                  {bundle.shareUrl ? (
                    <>
                      <TouchableOpacity
                        onPress={() => handleCopy(bundle.shareUrl!)}
                        activeOpacity={0.85}
                        style={styles.secondaryButton}
                      >
                        <Ionicons name="copy-outline" size={16} color="#076B51" />
                        <Text style={styles.secondaryButtonText}>Copy</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleShare(bundle)}
                        activeOpacity={0.85}
                        style={styles.actionButton}
                      >
                        <Ionicons name="share-social-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Share</Text>
                      </TouchableOpacity>
                    </>
                  ) : null}
                  <TouchableOpacity
                    onPress={() => handleDelete(bundle)}
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
