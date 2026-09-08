import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { FloatingCard, IconAvatar, PremiumHeader, premiumStyles } from "../../components/shared/PremiumBlocks";

const STEPS: { icon: React.ComponentProps<typeof Ionicons>["name"]; title: string; body: string }[] = [
  {
    icon: "bag-add-outline",
    title: "Choose how many shares you want",
    body: "Pick a quantity based on the price per share shown on the campaign. Your card is saved against that quantity, but nothing is charged yet.",
  },
  {
    icon: "people-outline",
    title: "Other people contribute too",
    body: "Every campaign has a minimum, a goal, and a maximum. As more people join, the campaign gets closer to its minimum — the amount actually needed for it to go ahead.",
  },
  {
    icon: "time-outline",
    title: "The campaign reaches its deadline",
    body: "Every campaign has a closing date. What happens next depends on how many shares were confirmed by then.",
  },
  {
    icon: "checkmark-circle-outline",
    title: "If the minimum is reached, it proceeds",
    body: "Reaching the goal is a bonus, not a requirement — the campaign proceeds as soon as the minimum is met, even if the goal isn't reached.",
  },
  {
    icon: "hourglass-outline",
    title: "If the minimum isn't reached, there's a completion period",
    body: "The organiser gets a short window to close the gap — by inviting more people or topping up themselves — before the campaign is decided as failed.",
  },
  {
    icon: "return-down-back-outline",
    title: "If it ultimately fails, nothing was ever charged",
    body: "Eki never takes payment upfront. If a campaign fails, your saved payment method is simply released — there is nothing to refund because nothing was taken.",
  },
];

export default function CommunityBuyHowItWorksScreen() {
  const router = useRouter();

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title="How Community Buy works" onBack={() => goBackOrReplace(router, "/(buyer)/community-buy" as any)} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        <View style={[premiumStyles.block, { gap: 12 }]}>
          <Text style={styles.intro}>
            Community Buy lets a group of buyers unlock a supplier's bulk price together. Here's exactly how it works, step by step.
          </Text>
          {STEPS.map((step, index) => (
            <FloatingCard key={step.title} style={styles.stepCard}>
              <IconAvatar icon={step.icon} tone="success" size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.stepIndex}>Step {index + 1}</Text>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepBody}>{step.body}</Text>
              </View>
            </FloatingCard>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#4A5A52", lineHeight: 19 },
  stepCard: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepIndex: { fontSize: 10, fontFamily: "Manrope-ExtraBold", color: "#8AA194", textTransform: "uppercase", letterSpacing: 0.4 },
  stepTitle: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#151E1B", marginTop: 2 },
  stepBody: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72", lineHeight: 17, marginTop: 4 },
});
