import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { goBackOrReplace } from "../../utils/navigation";
import { FloatingCard, IconAvatar, PremiumHeader, premiumStyles } from "../../components/shared/PremiumBlocks";
import { marketingService } from "../../services/marketingService";

const GRID_TOOLS = [
  {
    icon: "pricetag-outline",
    title: "Create coupon",
    subtitle: "Share a real promo code",
    route: "/(vendor)/create-discount",
    tone: "success",
  },
  {
    icon: "cube-outline",
    title: "Create bundle",
    subtitle: "Sell foodstuff together",
    route: "/(vendor)/create-bundle",
    tone: "success",
  },
  {
    icon: "flash-outline",
    title: "Flash sale",
    subtitle: "Time-limited price drop",
    route: "/(vendor)/create-flash-sale",
    tone: "warning",
  },
  {
    icon: "chatbubble-ellipses-outline",
    title: "Message buyers",
    subtitle: "Send a private offer",
    route: "/(vendor)/send-offer",
    tone: "success",
  },
  {
    icon: "bar-chart-outline",
    title: "View analytics",
    subtitle: "Public store activity",
    route: "/(vendor)/analytics",
    tone: "info",
  },
  {
    icon: "share-social-outline",
    title: "Share store link",
    subtitle: "Get direct sales",
    route: "/(vendor)/share-store-link",
    tone: "success",
  },
] as const;

type ActivityKind = "Discount" | "Bundle" | "Flash Sale";

interface ActivityItem {
  id: string;
  kind: ActivityKind;
  name: string;
  usedCount: number;
  createdAt: string;
  route: string;
}

export default function GrowSalesScreen() {
  const router = useRouter();
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);

  const loadActivity = useCallback(() => {
    setLoadingActivity(true);
    Promise.all([
      marketingService.listDiscounts().catch(() => []),
      marketingService.listBundles().catch(() => []),
      marketingService.listFlashSales().catch(() => []),
    ])
      .then(([discounts, bundles, flashSales]) => {
        const merged: ActivityItem[] = [
          ...discounts.map((d) => ({ id: d.id, kind: "Discount" as const, name: d.code ?? "Discount", usedCount: 0, createdAt: d.createdAt, route: "/(vendor)/coupon-history" })),
          ...bundles.map((b) => ({ id: b.id, kind: "Bundle" as const, name: b.name || "Bundle", usedCount: b.quantitySold, createdAt: b.createdAt, route: "/(vendor)/bundle-history" })),
          ...flashSales.map((f) => ({ id: f.id, kind: "Flash Sale" as const, name: f.currency ? `Flash sale (${f.currency})` : "Flash sale", usedCount: 0, createdAt: f.createdAt, route: "/(vendor)/flash-sale-history" })),
        ].sort((a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || ""));
        setActivity(merged.slice(0, 6));
      })
      .finally(() => setLoadingActivity(false));
  }, []);

  useFocusEffect(loadActivity);

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader
        title="Grow your sales"
        subtitle="Bring back past buyers and get more orders"
        onBack={() => goBackOrReplace(router, "/(vendor)/settings" as any)}
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        <View style={[premiumStyles.block, { gap: 14 }]}>
          <Text style={styles.sectionTitle}>Marketing campaigns</Text>

          <View style={styles.grid}>
            {GRID_TOOLS.map((tool) => (
              <TouchableOpacity key={tool.title} onPress={() => router.push(tool.route as any)} activeOpacity={0.85} style={styles.gridItem}>
                <FloatingCard style={styles.gridCard}>
                  <IconAvatar icon={tool.icon as any} tone={tool.tone} size={48} />
                  <Text style={styles.gridLabel}>{tool.title}</Text>
                  <Text style={styles.gridSubtitle}>{tool.subtitle}</Text>
                </FloatingCard>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity onPress={() => router.push("/(vendor)/send-offer" as any)} activeOpacity={0.88} style={styles.sendOfferButton}>
            <Text style={styles.sendOfferText}>Send offer to buyers</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Recent marketing activity</Text>
          {loadingActivity ? (
            <ActivityIndicator color="#076B51" style={{ marginVertical: 12 }} />
          ) : activity.length === 0 ? (
            <FloatingCard style={styles.emptyActivityCard}>
              <Text style={styles.emptyActivityText}>You have not created a marketing campaign yet.</Text>
            </FloatingCard>
          ) : (
            <View style={{ gap: 8 }}>
              {activity.map((item) => (
                <TouchableOpacity key={`${item.kind}-${item.id}`} onPress={() => router.push(item.route as any)} activeOpacity={0.85}>
                  <FloatingCard style={styles.activityRow}>
                    <IconAvatar
                      icon={item.kind === "Bundle" ? "cube-outline" : item.kind === "Flash Sale" ? "flash-outline" : "pricetag-outline"}
                      tone="success"
                      size={36}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityTitle}>{item.name}</Text>
                      <Text style={styles.activitySubtitle}>
                        {item.kind} · {item.usedCount} used · {new Date(item.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                  </FloatingCard>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <LinearGradient colors={["#2C2C2C", "#000000"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tipCard}>
            <Text style={styles.tipTitle}>Marketing tip</Text>
            <Text style={styles.tipBody}>
              Coupon codes and direct buyer messages work best when the offer is short and the expiry is clear.
            </Text>
          </LinearGradient>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 15, fontFamily: "Manrope-ExtraBold", color: "#12221A" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between" },
  gridItem: { width: "48%" },
  gridCard: { alignItems: "center", justifyContent: "center", minHeight: 150, gap: 4 },
  gridLabel: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#151E1B", textAlign: "center", marginTop: 6 },
  gridSubtitle: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#6A7B72", textAlign: "center" },
  sendOfferButton: { minHeight: 54, borderRadius: 16, backgroundColor: "#076B51", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  sendOfferText: { fontSize: 15, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  tipCard: { borderRadius: 24, padding: 20 },
  tipTitle: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#FFFFFF", marginBottom: 6 },
  tipBody: { fontSize: 13, fontFamily: "Outfit-Regular", color: "rgba(255,255,255,0.75)", lineHeight: 19 },
  emptyActivityCard: { alignItems: "center", paddingVertical: 20 },
  emptyActivityText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#6A7B72", textAlign: "center" },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  activityTitle: { fontSize: 13.5, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
  activitySubtitle: { fontSize: 11.5, fontFamily: "Outfit-Regular", color: "#6A7B72", marginTop: 2 },
});
