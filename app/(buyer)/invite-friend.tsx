import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { getPublicReferralUrl } from "../../utils/shareLinks";
import { referralService, type ReferralInfo } from "../../services/referralService";
import { rewardService, type Reward } from "../../services/rewardService";
import { useAuthStore } from "../../stores/authStore";
import { goBackOrReplace } from "../../utils/navigation";

export default function InviteFriendScreen() {
  const router = useRouter();
  const userReferralCode = useAuthStore((state) => state.user?.referralCode ?? "");
  const [copied, setCopied] = useState(false);
  const [referralInfo, setReferralInfo] = useState<ReferralInfo | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadReferral = React.useCallback(() => {
    let mounted = true;
    setLoading(true);
    setLoadError("");

    Promise.all([
      referralService.getMyReferralInfo().catch(() => null),
      rewardService.getActiveRewards().catch(() => []),
    ])
      .then(([nextReferralInfo, nextRewards]) => {
        if (!mounted) return;
        if (nextReferralInfo) setReferralInfo(nextReferralInfo);
        setRewards(nextRewards);
      })
      .catch(() => {
        if (mounted) setLoadError("Could not load referral info.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => loadReferral(), [loadReferral]);

  const referralCode = referralInfo?.referralCode || userReferralCode || "";
  const referralUrl = getPublicReferralUrl(referralCode);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join Eki and use my referral code ${referralCode} to get started.\n${referralUrl}`,
      });
    } catch {}
  };

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(`${referralCode}\n${referralUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleRewardPress = (reward: Reward) => {
    const haystack = `${reward.name} ${reward.description ?? ""}`.toLowerCase();
    if (haystack.includes("referral") || haystack.includes("invite")) {
      handleShare();
      return;
    }
    if (haystack.includes("bundle")) {
      router.push({ pathname: "/(buyer)/explore", params: { view: "products" } } as any);
      return;
    }
    // Minimum-spend and admin-defined rewards: send the buyer to the products
    // that qualify them, since rewards carry no dedicated landing screen.
    router.push({ pathname: "/(buyer)/explore", params: { view: "products" } } as any);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)/wallet" as any)} activeOpacity={0.85} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invite a Friend</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.heroIcon}>
          <Ionicons name="gift" size={48} color="#076B51" />
        </View>

        <Text style={styles.title}>Invite friends, earn rewards</Text>
        <Text style={styles.body}>
          Share your personal referral code. When an invited buyer completes their first paid order, the reward is credited to your Eki wallet.
        </Text>

        <View style={styles.ruleBanner}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#076B51" />
          <Text style={styles.ruleBannerText}>
            Referral code, invite count, and earned credit on this screen are loaded from your live Eki account.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color="#076B51" />
          </View>
        ) : referralCode ? (
          <>
            <Text style={styles.codeLabel}>Your referral code</Text>
            <View style={styles.codeRow}>
              <Text style={styles.codeText}>{referralCode}</Text>
              <TouchableOpacity onPress={handleCopy} activeOpacity={0.7} style={styles.copyIcon}>
                <Ionicons name={copied ? "checkmark" : "copy-outline"} size={18} color="#076B51" />
              </TouchableOpacity>
            </View>
            {copied ? <Text style={styles.copiedFeedback}>Copied to clipboard</Text> : null}
          </>
        ) : (
          <View style={styles.errorBlock}>
            <Text style={styles.errorText}>{loadError || "We could not load your referral code right now."}</Text>
            <TouchableOpacity onPress={loadReferral} activeOpacity={0.85} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          onPress={handleShare}
          disabled={!referralCode}
          activeOpacity={0.85}
          style={[styles.shareBtn, !referralCode && { opacity: 0.5 }]}
        >
          <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
          <Text style={styles.shareBtnText}>Share Referral Link</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleCopy}
          disabled={!referralCode}
          activeOpacity={0.85}
          style={[styles.copyBtn, !referralCode && { opacity: 0.5 }]}
        >
          <Ionicons name={copied ? "checkmark" : "copy-outline"} size={18} color="#076B51" />
          <Text style={styles.copyBtnText}>{copied ? "Copied!" : "Copy Code"}</Text>
        </TouchableOpacity>

        {rewards.length > 0 ? (
          <View style={styles.rewardSection}>
            <Text style={styles.rewardSectionTitle}>Available gifts</Text>
            {rewards.map((reward) => (
              <TouchableOpacity key={reward.id} onPress={() => handleRewardPress(reward)} activeOpacity={0.85} style={styles.rewardCard}>
                <View style={styles.rewardIcon}>
                  <Ionicons name={reward.type === "WALLET_BONUS" ? "wallet-outline" : reward.type === "FREE_SHIPPING" ? "car-outline" : "pricetag-outline"} size={18} color="#076B51" />
                </View>
                <View style={styles.rewardInfo}>
                  <Text style={styles.rewardName}>{reward.name}</Text>
                  <Text style={styles.rewardDesc}>{reward.description || `${reward.currency} ${reward.value.toFixed(2)} ${reward.type.replace(/_/g, " ").toLowerCase()}`}</Text>
                </View>
                <Text style={styles.rewardValue}>{reward.currency} {reward.value.toFixed(2)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828" },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 32, alignItems: "center" },
  heroIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(7,107,81,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontFamily: "Manrope-Bold",
    color: "#282828",
    textAlign: "center",
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    fontFamily: "Outfit-Regular",
    color: "#858585",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 18,
  },
  ruleBanner: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(7,107,81,0.08)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 22,
  },
  ruleBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Outfit-Regular",
    color: "#24564A",
  },
  loaderWrap: {
    width: "100%",
    paddingVertical: 32,
    alignItems: "center",
  },
  codeLabel: {
    fontSize: 12,
    fontFamily: "Outfit-Medium",
    color: "#858585",
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  codeRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    marginBottom: 4,
  },
  codeText: {
    fontSize: 16,
    fontFamily: "Manrope-Bold",
    color: "#282828",
    letterSpacing: 1.2,
  },
  copyIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(7,107,81,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  copiedFeedback: {
    fontSize: 12,
    fontFamily: "Outfit-Medium",
    color: "#076B51",
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Outfit-Regular",
    color: "#FB6363",
    marginBottom: 20,
  },
  errorBlock: { width: "100%", alignItems: "center", marginBottom: 20 },
  retryButton: { marginTop: 10, minHeight: 38, borderRadius: 12, borderWidth: 1, borderColor: "#076B51", paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  retryButtonText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  shareBtn: {
    width: "100%",
    height: 52,
    borderRadius: 14,
    backgroundColor: "#076B51",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
  },
  shareBtnText: { fontSize: 15, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  copyBtn: {
    width: "100%",
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#076B51",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
  },
  copyBtnText: { fontSize: 15, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  rewardSection: { width: "100%", marginTop: 24 },
  rewardSectionTitle: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 10 },
  rewardCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#F0F0F0" },
  rewardIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(7,107,81,0.1)", alignItems: "center", justifyContent: "center" },
  rewardInfo: { flex: 1 },
  rewardName: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  rewardDesc: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },
  rewardValue: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#076B51" },
});
