import React, { useCallback, useState } from "react";
import { Alert, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFocusRefresh } from "../../hooks/useFocusRefresh";
import { goBackOrReplace } from "../../utils/navigation";
import { growthService, type FirstSaleCampaignView } from "../../services/growthService";
import {
  ErrorState,
  FloatingCard,
  LoadingBlock,
  OutlineButton,
  PremiumHeader,
  PrimaryButton,
  premiumStyles,
} from "../../components/shared/PremiumBlocks";

const FUNNEL: { key: keyof FirstSaleCampaignView["funnel"]; label: string }[] = [
  { key: "visits", label: "Store visits" },
  { key: "baskets", label: "Added to basket" },
  { key: "checkouts", label: "Checkouts started" },
  { key: "payments", label: "Successful payments" },
];

/** Handbook 8.3: check the store, pick what to lead with, approve, share and watch what happens. */
export default function FirstSaleCampaignScreen() {
  const router = useRouter();
  const [view, setView] = useState<FirstSaleCampaignView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [launching, setLaunching] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setView(await growthService.getFirstSaleCampaign());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your campaign.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusRefresh(load, 0);

  const launch = () => {
    if (!view) return;
    const audience = view.audience.eligibleBuyers;
    Alert.alert(
      "Approve your campaign?",
      `We'll introduce your store to ${audience === 1 ? "1 buyer" : `up to ${audience} buyers`} near you who agreed to hear about new stores. This costs you nothing.`,
      [
        { text: "Not yet", style: "cancel" },
        {
          text: "Approve and start",
          onPress: () => {
            setLaunching(true);
            growthService.launchFirstSaleCampaign()
              .then(setView)
              .catch((err) => Alert.alert("Couldn't start your campaign", err instanceof Error ? err.message : "Please try again."))
              .finally(() => setLaunching(false));
          },
        },
      ],
    );
  };

  const running = view?.status === "ACTIVE";
  const started = running || view?.status === "COMPLETED" || view?.status === "STOPPED";

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title="First Sale Campaign" subtitle="Get your store in front of its first buyers" onBack={() => goBackOrReplace(router, "/(vendor)" as any)} />
      {loading ? (
        <LoadingBlock />
      ) : error || !view ? (
        <View style={premiumStyles.block}><ErrorState message={error || "Please try again."} onRetry={() => void load()} /></View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
          <View style={[premiumStyles.block, { gap: 14 }]}>
            {view.status === "COMPLETED" || view.status === "NOT_NEEDED" ? (
              <FloatingCard style={{ gap: 8 }}>
                <Text style={styles.title}>You've made your first sale</Text>
                <Text style={styles.body}>Ask your buyer for a review and invite them to order again.</Text>
                <PrimaryButton label="Invite other vendors" onPress={() => router.push("/(vendor)/referrals" as any)} />
              </FloatingCard>
            ) : null}

            {!started && view.status !== "NOT_NEEDED" ? (
              <FloatingCard style={{ gap: 10 }}>
                <Text style={styles.title}>Is your store ready?</Text>
                {view.readiness.map((check) => (
                  <TouchableOpacity
                    key={check.key}
                    disabled={check.done}
                    onPress={() => router.push(check.route as any)}
                    activeOpacity={0.85}
                    style={styles.row}
                    accessibilityRole="button"
                    accessibilityLabel={`${check.label}, ${check.done ? "done" : "to do"}`}
                  >
                    <Ionicons name={check.done ? "checkmark-circle" : check.blocking ? "ellipse-outline" : "information-circle-outline"} size={20} color={check.done ? "#076B51" : check.blocking ? "#B48A00" : "#8AA194"} />
                    <Text style={[styles.body, { flex: 1 }]}>{check.label}</Text>
                    {check.done ? null : <Ionicons name="chevron-forward" size={16} color="#C7D2CB" />}
                  </TouchableOpacity>
                ))}
              </FloatingCard>
            ) : null}

            {view.launchProducts.length > 0 && view.status !== "NOT_NEEDED" ? (
              <FloatingCard style={{ gap: 8 }}>
                <Text style={styles.title}>{started ? "What we're leading with" : "What we'll lead with"}</Text>
                {view.launchProducts.map((p) => <Text key={p.id} style={styles.body}>{p.title}</Text>)}
              </FloatingCard>
            ) : null}

            {!started && view.status !== "NOT_NEEDED" ? (
              <>
                {view.enabled ? null : <Text style={styles.body}>First Sale Campaigns are switched off right now.</Text>}
                <PrimaryButton label="Approve and start" onPress={launch} disabled={!view.canLaunch} loading={launching} />
              </>
            ) : null}

            {running ? (
              <FloatingCard style={{ gap: 8 }}>
                <Text style={styles.title}>What to do next</Text>
                <Text style={styles.body}>{view.nextStep?.advice ?? "Keep your stock up to date while we introduce your store."}</Text>
                <Text style={styles.meta}>{view.audience.messaged === 1 ? "1 buyer" : `${view.audience.messaged} buyers`} told about your store</Text>
              </FloatingCard>
            ) : null}

            {started ? (
              <FloatingCard style={{ gap: 8 }}>
                <Text style={styles.title}>How it's going</Text>
                {FUNNEL.map((step) => (
                  <View key={step.key} style={styles.row}>
                    <Text style={[styles.body, { flex: 1 }]}>{step.label}</Text>
                    <Text style={styles.count}>{view.funnel[step.key]}</Text>
                  </View>
                ))}
              </FloatingCard>
            ) : null}

            {view.status !== "NOT_NEEDED" ? (
              <OutlineButton label="Share your store link" onPress={() => void Share.share({ message: view.assets.shareMessage }).catch(() => undefined)} />
            ) : null}
            {view.status === "STOPPED" ? <Text style={styles.meta}>This campaign has been stopped by Eki. Contact support if you need help.</Text> : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#102118" },
  body: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#516A60", lineHeight: 20 },
  meta: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#8AA194" },
  count: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#102118" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
});
