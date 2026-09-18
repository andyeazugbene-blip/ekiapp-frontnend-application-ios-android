import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusRefresh } from "../../hooks/useFocusRefresh";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import {
  ErrorState,
  FloatingCard,
  IconAvatar,
  LoadingBlock,
  PremiumHeader,
  premiumStyles,
} from "../../components/shared/PremiumBlocks";
import { communityBuyService } from "../../services/communityBuyService";

type ConnectStatus = {
  providerConnectedAccountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
};

// Diaspora escrow reconciliation (final V1 settlement doc §N item 5) —
// organiser's Stripe Connect onboarding/status screen. Mirrors
// (supplier)/community-buy-supplier.tsx's "Set up payouts" banner exactly
// (same Linking.openURL handoff to a Stripe-hosted onboarding flow), but as
// its own screen since the organiser has no equivalent dashboard card to
// live inside. Read-only status display — never a toggle for the
// production payout flag, which stays admin/ops-only regardless of what
// this screen shows.
export default function CommunityBuyOrganiserPayoutsScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setStatus(await communityBuyService.getOrganiserStripeConnectStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your payout setup status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusRefresh(load);

  const handleSetUp = async () => {
    setConnecting(true);
    try {
      const { onboardingUrl } = await communityBuyService.onboardOrganiserStripeConnect();
      await Linking.openURL(onboardingUrl);
    } catch (err) {
      Alert.alert("Couldn't start payout setup", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  const handleContinue = async () => {
    setConnecting(true);
    try {
      const { onboardingUrl } = await communityBuyService.refreshOrganiserStripeConnect();
      await Linking.openURL(onboardingUrl);
    } catch (err) {
      Alert.alert("Couldn't continue payout setup", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  const goBack = () => goBackOrReplace(router, "/(buyer)/community-buy-organiser" as any);

  if (loading) {
    return (
      <View style={premiumStyles.page}>
        <PremiumHeader title="Payouts & Stripe Connect" onBack={goBack} />
        <LoadingBlock />
      </View>
    );
  }

  if (error || !status) {
    return (
      <View style={premiumStyles.page}>
        <PremiumHeader title="Payouts & Stripe Connect" onBack={goBack} />
        <View style={premiumStyles.block}><ErrorState message={error || "Check your connection and try again."} onRetry={() => void load()} /></View>
      </View>
    );
  }

  const verified = status.payoutsEnabled && status.chargesEnabled;
  const pending = !!status.providerConnectedAccountId && !verified;
  const notStarted = !status.providerConnectedAccountId;

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title="Payouts & Stripe Connect" onBack={goBack} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        <View style={[premiumStyles.block, { gap: 14 }]}>
          {notStarted ? (
            <FloatingCard style={styles.introCard}>
              <IconAvatar icon="card-outline" tone="warning" size={52} />
              <Text style={styles.introTitle}>Set up payouts</Text>
              <Text style={styles.introBody}>
                To receive your share of a successful campaign's proceeds, you need a Stripe account. This only takes a few minutes and Stripe handles all your bank details directly — Eki never sees them.
              </Text>
              <TouchableOpacity
                onPress={() => void handleSetUp()}
                disabled={connecting}
                activeOpacity={0.88}
                style={styles.primaryBtn}
                accessibilityRole="button"
                accessibilityLabel="Set up payouts"
                accessibilityState={{ busy: connecting, disabled: connecting }}
              >
                {connecting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Set up payouts</Text>}
              </TouchableOpacity>
            </FloatingCard>
          ) : pending ? (
            <FloatingCard style={styles.introCard}>
              <IconAvatar icon="time-outline" tone="warning" size={52} />
              <Text style={styles.introTitle}>Verification pending</Text>
              <Text style={styles.introBody}>
                Your Stripe account has been started but isn't fully verified yet{status.detailsSubmitted ? " — Stripe is reviewing the details you submitted" : " — you have unfinished steps to complete"}. You can't receive a payout until this is done.
              </Text>
              <TouchableOpacity
                onPress={() => void handleContinue()}
                disabled={connecting}
                activeOpacity={0.88}
                style={styles.primaryBtn}
                accessibilityRole="button"
                accessibilityLabel="Continue setup"
                accessibilityState={{ busy: connecting, disabled: connecting }}
              >
                {connecting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Continue setup</Text>}
              </TouchableOpacity>
            </FloatingCard>
          ) : (
            <FloatingCard style={styles.introCard}>
              <IconAvatar icon="checkmark-circle-outline" tone="success" size={52} />
              <Text style={styles.introTitle}>Payouts verified</Text>
              <Text style={styles.introBody}>
                Your Stripe account is set up and ready to receive payouts. When one of your campaigns succeeds, Eki releases your share of the proceeds — net of Eki's organiser commission — to this account.
              </Text>
            </FloatingCard>
          )}

          <FloatingCard style={{ gap: 6 }}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Account created</Text>
              <Ionicons name={status.providerConnectedAccountId ? "checkmark-circle" : "ellipse-outline"} size={16} color={status.providerConnectedAccountId ? "#076B51" : "#C7D2CB"} />
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Details submitted</Text>
              <Ionicons name={status.detailsSubmitted ? "checkmark-circle" : "ellipse-outline"} size={16} color={status.detailsSubmitted ? "#076B51" : "#C7D2CB"} />
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Payouts enabled</Text>
              <Ionicons name={status.payoutsEnabled ? "checkmark-circle" : "ellipse-outline"} size={16} color={status.payoutsEnabled ? "#076B51" : "#C7D2CB"} />
            </View>
          </FloatingCard>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  introCard: { alignItems: "center", gap: 8 },
  introTitle: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#151E1B" },
  introBody: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#6A7B72", textAlign: "center", lineHeight: 19 },
  primaryBtn: { marginTop: 6, minHeight: 48, minWidth: 180, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  primaryBtnText: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusLabel: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
});
