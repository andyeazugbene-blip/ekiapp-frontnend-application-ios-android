import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FloatingCard } from "../shared/PremiumBlocks";
import { communityBuyService, type Campaign } from "../../services/communityBuyService";

export const HOLD_OUTCOME_STATUSES = ["HOLD_WINDOW", "DECISION_REQUIRED", "AWAITING_SUPPLIER_RECONFIRMATION", "PAYMENT_CAPTURE"];

function formatDateTime(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
}

/** What an organiser sees and decides after joining closes on a two-stage campaign. */
export function OrganiserHoldOutcome({ campaign, onChanged }: { campaign: Campaign; onChanged: (updated: Campaign) => void }) {
  const [busy, setBusy] = useState<"proceed" | "cancel" | null>(null);
  const [error, setError] = useState("");

  const decide = async (action: "proceed" | "cancel") => {
    if (busy) return;
    setBusy(action);
    setError("");
    try {
      onChanged(await communityBuyService.decideCampaign(campaign.id, action));
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  if (campaign.status === "DECISION_REQUIRED") {
    return (
      <FloatingCard style={styles.card}>
        <View style={styles.row}>
          <Ionicons name="alert-circle-outline" size={20} color="#B48A00" />
          <Text style={styles.title}>Below the minimum</Text>
        </View>
        <Text style={styles.body}>
          Fewer shares than the minimum have a confirmed hold. You can go ahead with those shares if the supplier agrees, or end this Community Buy and release every hold. Nobody has been charged.
        </Text>
        <TouchableOpacity onPress={() => void decide("proceed")} disabled={!!busy} activeOpacity={0.88} style={styles.primary} accessibilityRole="button">
          {busy === "proceed" ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryText}>Ask the supplier to go ahead</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void decide("cancel")} disabled={!!busy} activeOpacity={0.88} style={styles.secondary} accessibilityRole="button">
          {busy === "cancel" ? <ActivityIndicator size="small" color="#076B51" /> : <Text style={styles.secondaryText}>End and release every hold</Text>}
        </TouchableOpacity>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </FloatingCard>
    );
  }

  const copy =
    campaign.status === "AWAITING_SUPPLIER_RECONFIRMATION"
      ? { icon: "time-outline" as const, title: "Waiting for the supplier", body: "We've asked the supplier to confirm the final quantity. If they don't, every hold is released and nobody is charged." }
      : campaign.status === "PAYMENT_CAPTURE"
        ? { icon: "card-outline" as const, title: "Your Community Buy is going ahead", body: "We're taking payment for every confirmed share now." }
        : { icon: "time-outline" as const, title: "Joining has closed", body: `We're confirming everyone's card holds. We'll decide the outcome after ${formatDateTime(campaign.decisionDeadline)}.` };

  return (
    <FloatingCard style={styles.card}>
      <View style={styles.row}>
        <Ionicons name={copy.icon} size={20} color="#076B51" />
        <Text style={styles.title}>{copy.title}</Text>
      </View>
      <Text style={styles.body}>{copy.body}</Text>
    </FloatingCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, fontSize: 14, fontFamily: "Manrope-Bold", color: "#151E1B" },
  body: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#516A60", lineHeight: 19 },
  primary: { minHeight: 46, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  primaryText: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  secondary: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: "#076B51", alignItems: "center", justifyContent: "center" },
  secondaryText: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#076B51" },
  error: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#D6552F" },
});
