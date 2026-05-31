import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../stores/authStore";
import { getPublicStoreUrl, toCompactStoreSlug } from "../../utils/shareLinks";
import { publicStoreService, type PublicStoreAnalyticsDetail } from "../../services/publicStoreService";

function emptyAnalytics(storeSlug: string): PublicStoreAnalyticsDetail {
  return {
    storeSlug,
    opens: 0,
    cartAdds: 0,
    checkoutStarts: 0,
    ordersPlaced: 0,
    trackRequests: 0,
    reorders: 0,
    appLaunches: 0,
    saveVendorCount: 0,
    weeklyOpens: 0,
    weeklyOrders: 0,
    conversionRate: 0,
    totalRevenue: 0,
    pendingRevenue: 0,
    completedOrders: 0,
    repeatRevenue: 0,
    sourceBreakdown: {
      instagram: 0,
      whatsapp: 0,
      sms: 0,
      direct: 0,
      tiktok: 0,
      more: 0,
      unknown: 0,
    },
    sourceOrders: {
      instagram: 0,
      whatsapp: 0,
      sms: 0,
      direct: 0,
      tiktok: 0,
      more: 0,
      unknown: 0,
    },
    sourceRevenue: {
      instagram: 0,
      whatsapp: 0,
      sms: 0,
      direct: 0,
      tiktok: 0,
      more: 0,
      unknown: 0,
    },
    sourcePerformance: [],
    topProducts: [],
  };
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export default function ShareStoreLinkScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const vendor = user?.role === "vendor" ? user : null;

  const storeSlug = toCompactStoreSlug(vendor?.storeSlug ?? vendor?.storeName);
  const baseStoreUrl = getPublicStoreUrl({
    storeSlug,
    storeName: vendor?.storeName,
  });
  const [analytics, setAnalytics] = useState<PublicStoreAnalyticsDetail>(emptyAnalytics(storeSlug));
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!storeSlug) {
        setAnalytics(emptyAnalytics(""));
        setLoading(false);
        return () => {
          active = false;
        };
      }

      setLoading(true);
      publicStoreService
        .getDetailedAnalytics(storeSlug)
        .then((result) => {
          if (active) setAnalytics(result);
        })
        .catch(() => {
          if (active) setAnalytics(emptyAnalytics(storeSlug));
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [storeSlug]),
  );

  const storePreviewParams = useMemo(
    () => ({ pathname: "/store/[slug]", params: { slug: storeSlug, preview: "1" } } as any),
    [storeSlug],
  );

  const withSource = useCallback(
    (source: string) => `${baseStoreUrl}${baseStoreUrl.includes("?") ? "&" : "?"}source=${encodeURIComponent(source)}`,
    [baseStoreUrl],
  );

  const shareMessage = useCallback(
    (source: string) => `Shop from ${vendor?.storeName ?? "my Eki store"} on Eki.\n${withSource(source)}`,
    [vendor?.storeName, withSource],
  );

  const handleCopy = async () => {
    await Clipboard.setStringAsync(withSource("direct"));
    Alert.alert("Copied", "Your store link is ready to send.");
  };

  const handleWhatsApp = async () => {
    const target = `https://wa.me/?text=${encodeURIComponent(shareMessage("whatsapp"))}`;
    try {
      await Linking.openURL(target);
    } catch {
      await Share.share({ message: shareMessage("whatsapp") });
    }
  };

  const handleInstagram = async () => {
    await Share.share({ message: shareMessage("instagram") });
  };

  const handleSms = async () => {
    const separator = "body=";
    const target = `sms:?${separator}${encodeURIComponent(shareMessage("sms"))}`;
    try {
      await Linking.openURL(target);
    } catch {
      await Share.share({ message: shareMessage("sms") });
    }
  };

  const handleMore = async () => {
    await Share.share({ message: shareMessage("more") });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View style={styles.brandPill}>
            <Text style={styles.brandPillText}>eki</Text>
          </View>
          <Text style={styles.topTitle}>My Store</Text>
          <TouchableOpacity
            onPress={() => router.push("/(vendor)/settings" as any)}
            activeOpacity={0.85}
            style={styles.moreButton}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color="#4A4A4A" />
          </TouchableOpacity>
        </View>

        <View style={styles.storeCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.storeName}>{vendor?.storeName ?? "Your store"}</Text>
            <Text style={styles.storeMeta}>
              {[vendor?.city, vendor?.country].filter(Boolean).join(", ") || "Vendor"} {"  \u00B7  "} Verified
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(vendor)/edit-store-profile" as any)}
            activeOpacity={0.85}
            style={styles.editButton}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your web store is live</Text>
          <Text style={styles.cardBody}>
            Buyers can order directly from your public store and track their order without waiting for DMs.
          </Text>

          <View style={styles.linkRow}>
            <Text style={styles.linkText} numberOfLines={1}>
              {withSource("direct")}
            </Text>
            <TouchableOpacity onPress={handleCopy} activeOpacity={0.85} style={styles.copyButton}>
              <Text style={styles.copyButtonText}>Copy</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.shareGrid}>
            <ShareButton label="WhatsApp" tone="green" icon="logo-whatsapp" onPress={handleWhatsApp} />
            <ShareButton label="Instagram" tone="pink" icon="logo-instagram" onPress={handleInstagram} />
            <ShareButton label="SMS" tone="darkGreen" icon="chatbox-ellipses-outline" onPress={handleSms} />
            <ShareButton label="More" tone="gray" icon="share-social-outline" onPress={handleMore} />
          </View>
        </View>

        <View style={styles.secondaryRow}>
          <TouchableOpacity onPress={() => router.push(storePreviewParams)} activeOpacity={0.85} style={styles.previewCard}>
            <View style={styles.previewIconWrap}>
              <Ionicons name="phone-portrait-outline" size={20} color="#0A6C52" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.previewTitle}>Store preview</Text>
              <Text style={styles.previewBody}>Open the buyer-facing store page and verify the live slug.</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(vendor)/analytics" as any)}
            activeOpacity={0.85}
            style={styles.previewCard}
          >
            <View style={styles.previewIconWrap}>
              <Ionicons name="bar-chart-outline" size={20} color="#0A6C52" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.previewTitle}>View analytics</Text>
              <Text style={styles.previewBody}>See link clicks, checkout starts, orders, and top products.</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.metricsStrip}>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#076B51" />
            </View>
          ) : (
            <>
              <StatTile label="Link clicks" value={String(analytics.opens)} />
              <StatTile label="This week" value={`+${analytics.weeklyOpens}`} />
              <StatTile label="Conversion" value={formatPercent(analytics.conversionRate)} />
            </>
          )}
        </View>

        <TouchableOpacity
          onPress={() => router.push("/(vendor)/analytics" as any)}
          activeOpacity={0.85}
          style={styles.primaryCta}
        >
          <Text style={styles.primaryCtaText}>Open analytics</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function ShareButton({
  label,
  icon,
  tone,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: "green" | "pink" | "darkGreen" | "gray";
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.shareButton, styles[`shareButton_${tone}`]]}>
      <Ionicons name={icon} size={16} color="#FFFFFF" />
      <Text style={styles.shareButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F6F7F6" },
  content: { paddingHorizontal: 16, paddingBottom: 28 },
  topBar: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  brandPill: {
    minWidth: 40,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#134E3B",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  brandPillText: { color: "#FFFFFF", fontSize: 13, fontFamily: "Manrope-Bold" },
  topTitle: { flex: 1, color: "#202124", fontSize: 16, fontFamily: "Manrope-Bold" },
  moreButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7ECEA",
    alignItems: "center",
    justifyContent: "center",
  },
  storeCard: {
    borderRadius: 18,
    backgroundColor: "#174F3D",
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 12,
  },
  storeName: { color: "#FFFFFF", fontSize: 22, lineHeight: 28, fontFamily: "Manrope-Bold" },
  storeMeta: { color: "#D6E9E1", fontSize: 13, lineHeight: 18, fontFamily: "Outfit-Regular", marginTop: 4 },
  editButton: {
    minWidth: 78,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  editButtonText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Manrope-Bold" },
  card: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderWidth: 1,
    borderColor: "#E7ECEA",
    marginBottom: 12,
  },
  cardTitle: { color: "#202124", fontSize: 16, fontFamily: "Manrope-Bold" },
  cardBody: { color: "#7A8188", fontSize: 13, lineHeight: 18, fontFamily: "Outfit-Regular", marginTop: 6 },
  linkRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  linkText: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#F2FAF5",
    borderWidth: 1,
    borderColor: "#E0EEE7",
    paddingHorizontal: 12,
    paddingVertical: 14,
    color: "#0A6C52",
    fontSize: 13,
    fontFamily: "Outfit-Medium",
  },
  copyButton: {
    minWidth: 72,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#174F3D",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  copyButtonText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Manrope-Bold" },
  shareGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  shareButton: {
    width: "47%",
    height: 44,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  shareButton_green: { backgroundColor: "#22C55E" },
  shareButton_pink: { backgroundColor: "#E1306C" },
  shareButton_darkGreen: { backgroundColor: "#174F3D" },
  shareButton_gray: { backgroundColor: "#6B7280" },
  shareButtonText: { color: "#FFFFFF", fontSize: 13, fontFamily: "Manrope-Bold" },
  secondaryRow: { gap: 10, marginBottom: 12 },
  previewCard: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderWidth: 1,
    borderColor: "#E7ECEA",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  previewIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#EEF8F3",
    alignItems: "center",
    justifyContent: "center",
  },
  previewTitle: { color: "#202124", fontSize: 15, fontFamily: "Manrope-Bold" },
  previewBody: { color: "#7A8188", fontSize: 12, lineHeight: 17, fontFamily: "Outfit-Regular", marginTop: 4 },
  metricsStrip: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7ECEA",
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
    marginBottom: 14,
  },
  loadingRow: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 20 },
  statTile: { flex: 1, paddingHorizontal: 14, paddingVertical: 16, borderRightWidth: 1, borderRightColor: "#EEF1EF" },
  statValue: { color: "#174F3D", fontSize: 22, lineHeight: 26, fontFamily: "Manrope-ExtraBold" },
  statLabel: { color: "#7A8188", fontSize: 12, lineHeight: 16, fontFamily: "Outfit-Regular", marginTop: 6 },
  primaryCta: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#174F3D",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryCtaText: { color: "#FFFFFF", fontSize: 15, fontFamily: "Manrope-Bold" },
});
