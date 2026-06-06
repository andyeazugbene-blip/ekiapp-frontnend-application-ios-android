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
import { marketingService, type Discount } from "../../services/marketingService";
import { productService } from "../../services/productService";
import { useAuthStore } from "../../stores/authStore";
import type { VendorProfile } from "../../types/auth";
import type { Product } from "../../types/product";
import { getPublicStoreUrl } from "../../utils/shareLinks";

const CURRENCY_SYMBOL = "\u00A3";

function formatDiscountValue(discount: Discount) {
  if (discount.kind === "percentage") {
    return `${discount.value}% off`;
  }

  return `${CURRENCY_SYMBOL}${discount.value.toFixed(2)} off`;
}

function formatDateRange(discount: Discount) {
  if (!discount.startsAt && !discount.endsAt) {
    return "No schedule";
  }

  const start = discount.startsAt ? new Date(discount.startsAt).toLocaleDateString() : "Now";
  const end = discount.endsAt ? new Date(discount.endsAt).toLocaleDateString() : "No expiry";
  return `${start} - ${end}`;
}

function getCouponStatus(discount: Discount) {
  const now = Date.now();
  const startsAt = discount.startsAt ? Date.parse(discount.startsAt) : null;
  const endsAt = discount.endsAt ? Date.parse(discount.endsAt) : null;

  if (startsAt && Number.isFinite(startsAt) && startsAt > now) {
    return { label: "Scheduled", tone: "scheduled" as const };
  }

  if (endsAt && Number.isFinite(endsAt) && endsAt < now) {
    return { label: "Expired", tone: "expired" as const };
  }

  return { label: "Active", tone: "active" as const };
}

export default function CouponHistoryScreen() {
  const router = useRouter();
  const vendor = useAuthStore((state) => (state.user?.role === "vendor" ? (state.user as VendorProfile) : null));

  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const baseStoreUrl = getPublicStoreUrl({
    shareUrl: vendor?.shareUrl,
    storeSlug: vendor?.storeSlug,
    storeName: vendor?.storeName,
  });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError("");

      Promise.all([
        marketingService.listDiscounts(),
        productService.getMyVendorProducts().catch(() => [] as Product[]),
      ])
        .then(([nextDiscounts, nextProducts]) => {
          if (!active) return;

          const byId = nextProducts.reduce<Record<string, Product>>((acc, product) => {
            acc[product.id] = product;
            return acc;
          }, {});

          setProducts(byId);
          setDiscounts(
            [...nextDiscounts].sort(
              (left, right) => Date.parse(right.createdAt || "") - Date.parse(left.createdAt || ""),
            ),
          );
        })
        .catch((err) => {
          if (!active) return;
          setError(err instanceof Error ? err.message : "Could not load coupon history.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, []),
  );

  const enrichedDiscounts = useMemo(
    () =>
      discounts.map((discount) => {
        const shareUrl =
          discount.shareUrl ??
          (discount.code
            ? `${baseStoreUrl}${baseStoreUrl.includes("?") ? "&" : "?"}promo=${encodeURIComponent(discount.code)}`
            : baseStoreUrl);

        const productNames =
          discount.productIds.length > 0
            ? discount.productIds.map((id) => products[id]?.name ?? "Unknown product")
            : ["All store products"];

        return {
          ...discount,
          shareUrl,
          productNames,
          status: getCouponStatus(discount),
        };
      }),
    [baseStoreUrl, discounts, products],
  );

  const handleCopy = async (shareUrl: string) => {
    await Clipboard.setStringAsync(shareUrl);
    Alert.alert("Copied", "Coupon link copied and ready to share.");
  };

  const handleShare = async (discount: Discount & { shareUrl: string }) => {
    await Share.share({
      message: `${vendor?.storeName ?? "My store"}: use ${discount.code ?? "this offer"}\n${discount.shareUrl}`,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.replace("/(vendor)/settings" as any)}
          activeOpacity={0.85}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={20} color="#202124" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Coupons Created</Text>
          <Text style={styles.headerSubtitle}>Review live codes, linked products, and share links.</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/(vendor)/create-discount" as any)}
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

          {enrichedDiscounts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="pricetag-outline" size={28} color="#076B51" />
              <Text style={styles.emptyTitle}>No coupons yet</Text>
              <Text style={styles.emptyBody}>
                Create a real coupon first, then share its link from here without losing the history.
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(vendor)/create-discount" as any)}
                activeOpacity={0.85}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Create Coupon</Text>
              </TouchableOpacity>
            </View>
          ) : (
            enrichedDiscounts.map((discount) => (
              <View key={discount.id} style={styles.couponCard}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.couponCode}>{discount.code ?? "No code"}</Text>
                    <Text style={styles.couponMeta}>{formatDiscountValue(discount)} · {formatDateRange(discount)}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      discount.status.tone === "expired"
                        ? styles.statusPillExpired
                        : discount.status.tone === "scheduled"
                          ? styles.statusPillScheduled
                          : styles.statusPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        discount.status.tone === "expired"
                          ? styles.statusPillTextExpired
                          : discount.status.tone === "scheduled"
                            ? styles.statusPillTextScheduled
                            : styles.statusPillTextActive,
                      ]}
                    >
                      {discount.status.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="cube-outline" size={16} color="#076B51" />
                  <Text style={styles.detailText} numberOfLines={2}>
                    {discount.productNames.join(", ")}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={16} color="#076B51" />
                  <Text style={styles.detailText}>
                    Created {new Date(discount.createdAt).toLocaleString()}
                  </Text>
                </View>

                <View style={styles.linkCard}>
                  <Text style={styles.linkLabel}>Share link</Text>
                  <Text style={styles.linkValue} numberOfLines={2}>
                    {discount.shareUrl}
                  </Text>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    onPress={() => handleCopy(discount.shareUrl)}
                    activeOpacity={0.85}
                    style={styles.secondaryButton}
                  >
                    <Ionicons name="copy-outline" size={16} color="#076B51" />
                    <Text style={styles.secondaryButtonText}>Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleShare(discount)}
                    activeOpacity={0.85}
                    style={styles.primaryButtonCompact}
                  >
                    <Ionicons name="share-social-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.primaryButtonCompactText}>Share</Text>
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
  couponCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E7ECEA",
    padding: 18,
    marginBottom: 14,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  couponCode: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#202124" },
  couponMeta: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#687076", marginTop: 4 },
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
  linkCard: {
    backgroundColor: "#F7F8F7",
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
  },
  linkLabel: { fontSize: 11, fontFamily: "Outfit-Medium", color: "#687076", textTransform: "uppercase" },
  linkValue: { fontSize: 13, lineHeight: 19, fontFamily: "Outfit-Regular", color: "#202124", marginTop: 6 },
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
  primaryButtonCompact: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonCompactText: { color: "#FFFFFF", fontSize: 13, fontFamily: "Manrope-SemiBold" },
});
