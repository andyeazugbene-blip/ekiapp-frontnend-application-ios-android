import React, { useCallback, useState } from "react";
import { ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { useFocusRefresh } from "../../hooks/useFocusRefresh";
import { goBackOrReplace } from "../../utils/navigation";
import { getPublicVendorReferralUrl } from "../../utils/shareLinks";
import { growthService, type VendorReferralOverview } from "../../services/growthService";
import {
  EmptyState,
  ErrorState,
  FloatingCard,
  LoadingBlock,
  OutlineButton,
  PremiumHeader,
  PrimaryButton,
  StatusPill,
  premiumStyles,
} from "../../components/shared/PremiumBlocks";

const STAGE_TONE: Record<string, "success" | "error" | "neutral"> = { Paid: "success", Reversed: "error" };

/** Handbook 8.6: a link, code and QR code, and where each referred vendor has got to. */
export default function VendorReferralsScreen() {
  const router = useRouter();
  const [data, setData] = useState<VendorReferralOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await growthService.getReferrals());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your referrals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusRefresh(load, 0);

  const link = data?.referralCode ? getPublicVendorReferralUrl(data.referralCode) : "";

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title="Invite other vendors" subtitle="Credit towards your Eki Membership" onBack={() => goBackOrReplace(router, "/(vendor)" as any)} />
      {loading ? (
        <LoadingBlock />
      ) : error || !data ? (
        <View style={premiumStyles.block}><ErrorState message={error || "Please try again."} onRetry={() => void load()} /></View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
          <View style={[premiumStyles.block, { gap: 14 }]}>
            <FloatingCard style={{ gap: 8 }}>
              <Text style={styles.title}>{data.qualifiedTowardsNext} of {data.needed} paying vendors</Text>
              <Text style={styles.body}>
                When {data.needed} vendors you invite start paying for Eki Membership, you can earn {data.monthsPerCredit} month{data.monthsPerCredit === 1 ? "" : "s"} of credit. Credit comes off your invoice and can't be paid out as cash. It's removed if a referral stops qualifying.
              </Text>
              {data.creditsReadyForReview > 0 ? <Text style={styles.note}>You've reached the target. Our team is reviewing your credit.</Text> : null}
              {data.monthsReleased > 0 ? <Text style={styles.note}>{data.monthsReleased} month{data.monthsReleased === 1 ? "" : "s"} of credit added so far.</Text> : null}
            </FloatingCard>

            {data.referralCode ? (
              <FloatingCard style={{ gap: 12, alignItems: "center" }}>
                <View accessible accessibilityRole="image" accessibilityLabel="QR code for your invite link">
                  <QRCode value={link} size={168} />
                </View>
                <Text style={styles.code} accessibilityLabel={`Your code is ${data.referralCode}`}>{data.referralCode}</Text>
                <PrimaryButton label="Share your invite" style={{ alignSelf: "stretch" }} onPress={() => void Share.share({ message: `Set up your store on Eki. Use my code ${data.referralCode}. ${link}` }).catch(() => undefined)} />
                <OutlineButton
                  label={copied ? "Link copied" : "Copy link"}
                  style={{ alignSelf: "stretch" }}
                  onPress={() => {
                    void Clipboard.setStringAsync(link);
                    setCopied(true);
                  }}
                />
              </FloatingCard>
            ) : null}

            <Text style={styles.title}>Vendors you've invited</Text>
            {data.referrals.length === 0 ? (
              <FloatingCard><EmptyState icon="people-outline" title="Nobody yet" body="Vendors who sign up with your code show up here." /></FloatingCard>
            ) : (
              data.referrals.map((referral, index) => (
                <FloatingCard key={`${referral.joinedAt}-${index}`} style={styles.row}>
                  <Text style={[styles.body, { flex: 1 }]}>{referral.storeName ?? "New vendor"}</Text>
                  <StatusPill label={referral.stage} tone={STAGE_TONE[referral.stage] ?? "neutral"} />
                </FloatingCard>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#102118" },
  body: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#516A60", lineHeight: 20 },
  note: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  code: { fontSize: 20, fontFamily: "Manrope-Bold", color: "#076B51", letterSpacing: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
});
