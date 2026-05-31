import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { getPublicReferralUrl } from "../../utils/shareLinks";
import { referralService, type ReferralInfo } from "../../services/referralService";

export default function InviteFriendScreen() {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [referralInfo, setReferralInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    referralService
      .getMyReferralInfo()
      .catch(() => null)
      .then((nextReferralInfo) => {
        if (!mounted) return;
        setReferralInfo(nextReferralInfo);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const referralCode = referralInfo?.referralCode ?? "";
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

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backBtn}>
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
          <Text style={styles.errorText}>We could not load your referral code right now.</Text>
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
});
