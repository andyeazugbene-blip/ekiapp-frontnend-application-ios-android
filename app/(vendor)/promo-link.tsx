import React, { useMemo } from "react";
import { Linking, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useAuthStore } from "../../stores/authStore";
import { getPublicStoreUrl } from "../../utils/shareLinks";

export default function PromoLinkScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const vendor = user?.role === "vendor" ? user : null;
  const params = useLocalSearchParams<{
    promo?: string;
    url?: string;
    productId?: string;
    productName?: string;
    campaignType?: string;
  }>();

  const storeUrl = useMemo(() => {
    const base = getPublicStoreUrl({
      shareUrl: vendor?.shareUrl,
      storeSlug: vendor?.storeSlug,
      storeName: vendor?.storeName,
    });
    const search = new URLSearchParams();
    if (params.promo) search.set("promo", params.promo);
    if (params.productId) search.set("product", params.productId);
    const query = search.toString();
    const canonicalUrl = query ? `${base}${base.includes("?") ? "&" : "?"}${query}` : base;
    return canonicalUrl || params.url || "";
  }, [vendor, params.productId, params.promo, params.url]);

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(storeUrl);
    } catch {}
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: `Check out ${vendor?.storeName ?? "my store"} on Eki! ${storeUrl}` });
    } catch {}
  };

  return (
    <View style={styles.page}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Store Link</Text>
          <Text style={styles.headerSubtitle}>Share your store with buyers so they can order.</Text>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your link</Text>

          {params.promo ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Promo: {params.promo}</Text>
            </View>
          ) : null}

          {params.campaignType ? (
            <Text style={styles.campaignCopy}>
              {params.campaignType === "discount"
                ? params.productName
                  ? `This discount link opens ${params.productName} with the offer already attached.`
                  : "This discount link opens your store with the offer already attached."
                : params.campaignType === "bundle"
                  ? "This bundle link opens your store with the bundle campaign attached."
                  : "Share this campaign link with buyers."}
            </Text>
          ) : null}

          <Text style={styles.promoTitle}>Share this link with your buyers</Text>
          <Text style={styles.promoLink} numberOfLines={2}>{storeUrl}</Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity onPress={handleCopy} activeOpacity={0.85} style={styles.primaryButtonSmall}>
              <Text style={styles.primaryButtonText}>Copy Link</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} activeOpacity={0.85} style={styles.secondaryButtonSmall}>
              <Text style={styles.secondaryButtonText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          onPress={async () => {
            const message = `Check out ${vendor?.storeName ?? "my store"} on Eki! ${storeUrl}`;
            const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
            const canOpen = await Linking.canOpenURL(whatsappUrl).catch(() => false);
            if (canOpen) {
              Linking.openURL(whatsappUrl).catch(() => {});
            } else {
              handleShare();
            }
          }}
          activeOpacity={0.85}
          style={styles.card}
        >
          <View style={styles.whatsappRow}>
            <View style={styles.whatsappIcon}>
              <Ionicons name="logo-whatsapp" size={18} color="#076B51" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.whatsappTitle}>WhatsApp share</Text>
              <Text style={styles.whatsappSubtitle}>Open a ready-to-share message layout.</Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color="#076B51" />
          <Text style={styles.infoText}>
            When buyers open this link they will see your store and products. They can browse and place orders directly.
          </Text>
        </View>

        <TouchableOpacity onPress={() => router.back()} style={styles.primaryButton}>
          <Text style={styles.primaryButtonTextLarge}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F4F4F4",
  },
  headerSafeArea: {
    backgroundColor: "#076B51",
  },
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
  headerTitle: {
    fontSize: 30,
    fontFamily: "Manrope-Bold",
    lineHeight: 30,
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 16,
    fontFamily: "Outfit-Light",
    color: "#FFFFFF",
    marginTop: 6,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Manrope-Bold",
    color: "#282828",
    marginBottom: 16,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#076B51",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "Outfit-Medium",
    color: "#FFFFFF",
  },
  promoTitle: {
    fontSize: 18,
    fontFamily: "Manrope-Bold",
    color: "#282828",
    marginTop: 14,
  },
  campaignCopy: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Outfit-Regular",
    color: "#687076",
    marginTop: 12,
  },
  promoLink: {
    fontSize: 14,
    fontFamily: "Outfit-Regular",
    color: "#858585",
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  primaryButtonSmall: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonSmall: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#076B51",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    color: "#FFFFFF",
  },
  secondaryButtonText: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    color: "#076B51",
  },
  whatsappRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  whatsappIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#F4F4F4",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  whatsappTitle: {
    fontSize: 14,
    fontFamily: "Manrope-Bold",
    color: "#282828",
  },
  whatsappSubtitle: {
    fontSize: 14,
    fontFamily: "Outfit-Regular",
    color: "#858585",
    marginTop: 4,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#E8F4ED",
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Outfit-Regular",
    color: "#076B51",
    lineHeight: 18,
  },
  primaryButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonTextLarge: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    color: "#FFFFFF",
  },
});
