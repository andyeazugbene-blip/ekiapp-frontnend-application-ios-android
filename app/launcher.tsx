import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Redirect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFocusRefresh } from "../hooks/useFocusRefresh";
import { authService, type AccountDestinations } from "../services/authService";
import { useAuthStore } from "../stores/authStore";
import type { LastDestination } from "../types/auth";
import { goBackOrReplace } from "../utils/navigation";
import { startCommunityBuy } from "../utils/startCommunityBuy";

type IconName = keyof typeof Ionicons.glyphMap;

const SUPPLIER_STATUS: Record<string, { status: string; action: string }> = {
  DRAFT: { status: "Application not finished", action: "Finish your application" },
  VERIFICATION_REQUIRED: { status: "Verification needed", action: "Complete your application" },
  UNDER_REVIEW: { status: "Application under review", action: "View your application" },
  INFORMATION_REQUIRED: { status: "More information needed", action: "Update your application" },
  PAUSED: { status: "Supply paused", action: "Open Supplier Centre" },
  RESTRICTED: { status: "Supply restricted", action: "Open Supplier Centre" },
  SUSPENDED: { status: "Supply suspended", action: "Open Supplier Centre" },
  CLOSED: { status: "Supplier account closed", action: "Open Supplier Centre" },
  REJECTED: { status: "Application not approved", action: "See next steps" },
};

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function sellCopy(data: AccountDestinations | null, hasStore: boolean) {
  if (!hasStore || data?.sell.storeState === "none") return { status: null, action: "Create your store" };
  if (!data) return { status: null, action: "Open your store" };
  const orders = data.sell.ordersNeedingAttention;
  const action = orders > 0 ? `${plural(orders, "order needs", "orders need")} attention` : "Open your store";
  if (data.sell.storeState === "live") return { status: "Store live", action };
  if (data.sell.storeState === "restricted") return { status: "Store restricted", action };
  return { status: "Store not live yet", action: orders > 0 ? action : "Finish setting up your store" };
}

function communityCopy(data: AccountDestinations | null) {
  const active = data?.communityBuy.activeCount ?? 0;
  return { status: active > 0 ? `${active} active` : null, action: "Create a Community Buy" };
}

function supplyCopy(data: AccountDestinations | null) {
  if (!data) return { status: null, action: "Open Supplier Centre" };
  const { supplierState, invitationCount } = data.supply;
  if (supplierState === "APPROVED") {
    return {
      status: "Supplier approved",
      action: invitationCount > 0 ? `${plural(invitationCount, "invitation", "invitations")} waiting` : "Open Supplier Centre",
    };
  }
  return SUPPLIER_STATUS[supplierState] ?? { status: null, action: "Prepare your first offer" };
}

/**
 * Post-login destination launcher (spec M). Picking a card only routes the
 * user: capability and status come from the server, and no role is stored.
 */
export default function LauncherScreen() {
  const router = useRouter();
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasStore = useAuthStore((s) => s.user?.hasVendor === true);
  const setLastDestination = useAuthStore((s) => s.setLastDestination);
  const [data, setData] = useState<AccountDestinations | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setData(await authService.getDestinations());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusRefresh(load, 0);

  if (isInitializing) {
    return <View style={[styles.container, styles.center]}><ActivityIndicator color="#076B51" /></View>;
  }
  if (!isAuthenticated) return <Redirect href={{ pathname: "/(auth)/login", params: { redirect: "/launcher" } }} />;

  const go = (destination: LastDestination, href: string) => {
    setLastDestination(destination);
    router.push(href as any);
  };

  const sell = sellCopy(data, hasStore);
  const community = communityCopy(data);
  const supply = supplyCopy(data);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <LinearGradient colors={["#7DD8B0", "#A7E5C7", "#D4F1E0", "#F4F9F5"]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)" as any)} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={24} color="#101A16" />
          </TouchableOpacity>
          <Text style={styles.title} accessibilityRole="header">Sell, supply{"\n"}or organise</Text>

          <DestinationCard
            icon="storefront-outline"
            title="Sell foodstuff"
            status={sell.status}
            action={sell.action}
            onPress={() => go("sell", hasStore ? "/(vendor)" : "/(vendor-onboarding)/setup-store")}
          />
          <DestinationCard
            icon="cube-outline"
            title="Supply bulk orders"
            status={supply.status}
            action={supply.action}
            onPress={() => go("supply", "/(supplier)/community-buy-supplier")}
          />
          <DestinationCard
            icon="people-outline"
            title="Organise a Community Buy"
            status={community.status}
            action={community.action}
            onPress={() => {
              setLastDestination("community_buy");
              void startCommunityBuy(router);
            }}
          />

          {loading ? <ActivityIndicator color="#076B51" style={{ marginTop: 6 }} /> : null}
          {failed ? (
            <TouchableOpacity onPress={() => void load()} activeOpacity={0.8} style={styles.retry} accessibilityRole="button" accessibilityLabel="Retry loading your status">
              <Ionicons name="refresh-outline" size={15} color="#076B51" />
              <Text style={styles.retryText}>Couldn't load your latest status. Tap to retry.</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function DestinationCard({ icon, title, status, action, onPress }: {
  icon: IconName;
  title: string;
  status: string | null;
  action: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.86}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={[title, status, action].filter(Boolean).join(". ")}
    >
      <View style={styles.cardIcon}><Ionicons name={icon} size={24} color="#076B51" /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        {status ? <Text style={styles.cardStatus}>{status}</Text> : null}
        <Text style={styles.cardAction}>{action}</Text>
      </View>
      <Ionicons name="arrow-forward" size={18} color="#076B51" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: -8 },
  container: { flex: 1, backgroundColor: "#F4F9F5" },
  center: { alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 28, gap: 14 },
  title: { fontSize: 30, lineHeight: 38, fontFamily: "Manrope-ExtraBold", color: "#0B2B20", marginBottom: 8 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 96,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    shadowColor: "#0B2B20",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#E8F4EE", alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#12221A" },
  cardStatus: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51", marginTop: 3 },
  cardAction: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#5B6D64", marginTop: 3 },
  retry: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  retryText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#076B51" },
});
