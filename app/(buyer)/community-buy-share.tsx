import React, { useCallback, useState } from "react";
import { Linking, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { goBackOrReplace } from "../../utils/navigation";
import { getPublicCommunityBuyUrl } from "../../utils/shareLinks";
import { ErrorState, FloatingCard, LoadingBlock, PremiumHeader, premiumStyles } from "../../components/shared/PremiumBlocks";
import { communityBuyService, type Campaign } from "../../services/communityBuyService";

// B09 — dedicated share screen (previously just a native-share icon with no
// visible link/copy action). Reuses the exact WhatsApp/SMS/More deep-link
// pattern already proven in (vendor)/share-store-link.tsx, and the same
// public campaign URL the organiser's own share/copy-link action uses
// (getPublicCommunityBuyUrl) — no new sharing mechanism invented.
export default function CommunityBuyShareScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      setCampaign(await communityBuyService.getCampaign(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this campaign.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const backToCampaign = () => goBackOrReplace(router, { pathname: "/(buyer)/community-buy-campaign", params: { id } } as any);

  if (loading) {
    return (
      <View style={premiumStyles.page}>
        <PremiumHeader title="Share campaign" onBack={backToCampaign} />
        <LoadingBlock />
      </View>
    );
  }

  if (error || !campaign) {
    return (
      <View style={premiumStyles.page}>
        <PremiumHeader title="Share campaign" onBack={backToCampaign} />
        <View style={premiumStyles.block}><ErrorState message={error || "Check your connection and try again."} onRetry={() => void load()} /></View>
      </View>
    );
  }

  const url = getPublicCommunityBuyUrl(campaign.id);
  const message = `Join "${campaign.title}" on Eki Community Buy — ${campaign.confirmedShares} of ${campaign.maximumShares} slots filled. Open the Eki app to take part.\n${url}`;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = async () => {
    const target = `https://wa.me/?text=${encodeURIComponent(message)}`;
    try {
      await Linking.openURL(target);
    } catch {
      await Share.share({ message });
    }
  };

  const handleInstagram = async () => {
    await Share.share({ message });
  };

  const handleSms = async () => {
    const target = `sms:?body=${encodeURIComponent(message)}`;
    try {
      await Linking.openURL(target);
    } catch {
      await Share.share({ message });
    }
  };

  const handleMore = async () => {
    try {
      await Share.share({ message });
    } catch {
      // User cancelled the native share sheet — nothing to do.
    }
  };

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title="Share campaign" subtitle={campaign.title} onBack={backToCampaign} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        <View style={[premiumStyles.block, { gap: 14 }]}>
          <FloatingCard style={{ gap: 12 }}>
            <Text style={styles.title}>Share this Community Buy</Text>
            <Text style={styles.body}>Help your group reach the target.</Text>

            <View style={styles.linkRow}>
              <Text style={styles.linkText} numberOfLines={1}>{url}</Text>
              <TouchableOpacity onPress={() => void handleCopy()} activeOpacity={0.85} style={styles.copyButton} accessibilityRole="button" accessibilityLabel="Copy campaign link">
                <Text style={styles.copyButtonText}>{copied ? "Copied" : "Copy"}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.shareGrid}>
              <ShareButton label="WhatsApp" icon="logo-whatsapp" tone="green" onPress={handleWhatsApp} />
              <ShareButton label="Instagram" icon="logo-instagram" tone="pink" onPress={handleInstagram} />
              <ShareButton label="SMS" icon="chatbox-ellipses-outline" tone="darkGreen" onPress={handleSms} />
              <ShareButton label="More" icon="share-social-outline" tone="gray" onPress={handleMore} />
            </View>
            <Text style={styles.footerNote}>We'll include the campaign link and a short invitation message.</Text>
          </FloatingCard>
        </View>
      </ScrollView>
    </View>
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
    <TouchableOpacity
      onPress={() => void onPress()}
      activeOpacity={0.85}
      style={[styles.shareButton, styles[`shareButton_${tone}`]]}
      accessibilityRole="button"
      accessibilityLabel={`Share via ${label}`}
    >
      <Ionicons name={icon} size={16} color="#FFFFFF" />
      <Text style={styles.shareButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontFamily: "Manrope-ExtraBold", color: "#151E1B" },
  body: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#6A7B72", marginTop: -6 },
  footerNote: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#8AA194" },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  linkText: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: "#F4F6F5", paddingHorizontal: 12, paddingVertical: 12, fontSize: 12, fontFamily: "Outfit-Medium", color: "#076B51" },
  copyButton: { minWidth: 72, height: 44, borderRadius: 12, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  copyButtonText: { color: "#FFFFFF", fontSize: 13, fontFamily: "Manrope-Bold" },
  shareGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  shareButton: { width: "47%", height: 44, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  shareButton_green: { backgroundColor: "#22C55E" },
  shareButton_pink: { backgroundColor: "#E1306C" },
  shareButton_darkGreen: { backgroundColor: "#076B51" },
  shareButton_gray: { backgroundColor: "#6B7280" },
  shareButtonText: { color: "#FFFFFF", fontSize: 13, fontFamily: "Manrope-Bold" },
});
