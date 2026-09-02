import React, { useMemo } from "react";
import { Linking, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useAuthStore } from "../../stores/authStore";
import { getPublicStoreUrl } from "../../utils/shareLinks";
import { goBackOrReplace } from "../../utils/navigation";
import { FloatingCard, IconAvatar, OutlineButton, PremiumHeader, PrimaryButton, StatusPill, premiumStyles } from "../../components/shared/PremiumBlocks";

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

  const fallbackRoute = useMemo(
    () => (params.campaignType === "discount" ? "/(vendor)/coupon-history" : "/(vendor)/share-store-link"),
    [params.campaignType],
  );

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
    <View style={premiumStyles.page}>
      <PremiumHeader
        title="Your store link"
        subtitle="Share your store with buyers so they can order."
        onBack={() => goBackOrReplace(router, fallbackRoute as any)}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]}>
        <View style={[premiumStyles.block, { gap: 14 }]}>
          <FloatingCard style={{ gap: 10 }}>
            <Text style={styles.sectionTitle}>Your link</Text>

            {params.promo ? <StatusPill label={`Promo: ${params.promo}`} tone="success" /> : null}

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
              <PrimaryButton label="Copy link" onPress={() => void handleCopy()} style={{ flex: 1 }} />
              <OutlineButton label="Share" onPress={() => void handleShare()} style={{ flex: 1 }} />
            </View>
          </FloatingCard>

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
          >
            <FloatingCard style={styles.whatsappRow}>
              <IconAvatar icon="logo-whatsapp" tone="success" size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.whatsappTitle}>WhatsApp share</Text>
                <Text style={styles.whatsappSubtitle}>Open a ready-to-share message layout.</Text>
              </View>
            </FloatingCard>
          </TouchableOpacity>

          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={18} color="#076B51" />
            <Text style={styles.infoText}>
              When buyers open this link they will see your store and products. They can browse and place orders directly.
            </Text>
          </View>

          <PrimaryButton label="Done" onPress={() => goBackOrReplace(router, fallbackRoute as any)} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 15, fontFamily: "Manrope-ExtraBold", color: "#12221A" },
  promoTitle: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#151E1B", marginTop: 2 },
  campaignCopy: { fontSize: 13, lineHeight: 19, fontFamily: "Outfit-Regular", color: "#4A5A52" },
  promoLink: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  whatsappRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  whatsappTitle: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#151E1B" },
  whatsappSubtitle: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72", marginTop: 2 },
  infoCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#E8F4ED", borderRadius: 18, padding: 14 },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Outfit-Regular", color: "#076B51", lineHeight: 18 },
});
