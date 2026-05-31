import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { buyerService, type VendorBuyerProfile } from "../../services/buyerService";
import { Order } from "../../types/order";
import { openConversationThread } from "../../utils/messaging";

const CURRENCY_SYMBOL: Record<string, string> = {
  GBP: "\u00A3",
  USD: "$",
  EUR: "\u20AC",
  NGN: "\u20A6",
};

function formatDate(value: string | null | undefined, fallback = "No date"): string {
  if (!value) return fallback;
  try {
    return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return value;
  }
}

function summarizeOrderItems(order: Order): string {
  const names = order.items?.map((item) => item.product.name).filter(Boolean) ?? [];
  if (names.length === 0) return "No product details";
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} +${names.length - 3} more`;
}

function getInitials(name: string): string {
  const clean = name.trim();
  if (!clean) return "EK";
  return clean
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function StatCard({
  icon,
  label,
  value,
  tone = "light",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tone?: "light" | "green" | "dark";
}) {
  const green = tone === "green";
  const dark = tone === "dark";

  return (
    <View
      style={[
        styles.statCard,
        green && styles.statCardGreen,
        dark && styles.statCardDark,
      ]}
    >
      <View style={[styles.statIconWrap, green && styles.statIconWrapGreen, dark && styles.statIconWrapDark]}>
        <Ionicons name={icon} size={18} color={green || dark ? "#FFFFFF" : "#076B51"} />
      </View>
      <Text style={[styles.statLabel, (green || dark) && styles.statLabelInverse]}>{label}</Text>
      <Text style={[styles.statValue, (green || dark) && styles.statValueInverse]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export default function BuyerProfileScreen() {
  const router = useRouter();
  const { id, buyerId } = useLocalSearchParams<{ id?: string; buyerId?: string }>();
  const resolvedBuyerId = typeof id === "string" && id.length > 0 ? id : buyerId;

  const [profile, setProfile] = useState<VendorBuyerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startingChat, setStartingChat] = useState(false);

  useEffect(() => {
    if (!resolvedBuyerId) {
      setError("Missing buyer id.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const nextProfile = await buyerService.getBuyer(resolvedBuyerId);
        if (!cancelled) setProfile(nextProfile);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load buyer.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resolvedBuyerId]);

  const symbol = CURRENCY_SYMBOL[profile?.currency ?? "GBP"] ?? "\u00A3";
  const recentOrders = profile?.recentOrders ?? [];
  const mostRecent = recentOrders[0];
  const totalSpentText = `${symbol}${(profile?.totalSpent ?? 0).toFixed(2)}`;
  const lastOrderText = formatDate(profile?.lastOrderAt, "No orders yet");
  const joinedText = formatDate(profile?.joinedAt, "Unknown");
  const topProductText = profile?.topProductName?.trim() || "Not enough data yet";
  const heroSubline = useMemo(() => {
    if (!profile) return "";
    const country = profile.country?.trim() || "Buyer";
    const orderText = `${profile.totalOrders} ${profile.totalOrders === 1 ? "order" : "orders"}`;
    return `${country} \u00B7 ${orderText}`;
  }, [profile]);

  const handleMessageBuyer = async () => {
    if (!profile) return;
    setStartingChat(true);
    try {
      await openConversationThread({ participantId: profile.id, orderId: mostRecent?.id });
      router.push("/(vendor)/message-chat" as any);
    } catch (err) {
      Alert.alert("Could not open chat", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setStartingChat(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#282828" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Buyer profile</Text>
        </View>
        <View style={styles.placeholder}>
          <ActivityIndicator color="#076B51" />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#282828" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Buyer profile</Text>
        </View>
        <View style={styles.placeholder}>
          <Text style={styles.errorText}>{error || "Buyer not found."}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Buyer profile</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroName}>{profile.name}</Text>
              <Text style={styles.heroMeta}>{heroSubline}</Text>
              <View style={styles.heroBadge}>
                <Ionicons name="sparkles-outline" size={14} color="#D7F7EC" />
                <Text style={styles.heroBadgeText}>Buyer since {joinedText}</Text>
              </View>
            </View>

            {profile.avatar ? (
              <Image source={{ uri: profile.avatar }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarWrap}>
                <View style={styles.avatarRing} />
                <View style={styles.avatarInner}>
                  <Text style={styles.avatarInitials}>{getInitials(profile.name)}</Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.heroFooter}>
            <View style={styles.heroPill}>
              <Ionicons name="mail-outline" size={14} color="#B7DCCE" />
              <Text style={styles.heroPillText} numberOfLines={1}>
                {profile.email?.trim() || "No email shared"}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={styles.statsGrid}>
          <StatCard icon="receipt-outline" label="Orders count" value={String(profile.totalOrders)} />
          <StatCard icon="cash-outline" label="Total spent" value={totalSpentText} tone="green" />
          <StatCard icon="calendar-outline" label="Last order date" value={lastOrderText} tone="dark" />
          <StatCard icon="basket-outline" label="Top foodstuff purchased" value={topProductText} />
        </View>

        <Text style={styles.sectionTitle}>Recent orders</Text>
        {recentOrders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="cube-outline" size={20} color="#076B51" />
            <Text style={styles.emptyCardTitle}>No orders from this buyer yet</Text>
            <Text style={styles.emptyCardBody}>
              Once they place or complete an order, it will show up here with basket details and spend history.
            </Text>
          </View>
        ) : (
          recentOrders.map((order, index) => (
            <View key={order.id} style={[styles.orderCard, index === 0 && styles.orderCardFeatured]}>
              <View style={styles.orderCardHeader}>
                <View>
                  <Text style={[styles.orderLabel, index === 0 && styles.orderLabelInverse]}>
                    {order.orderNumber || `Order ${order.id}`}
                  </Text>
                  <Text style={[styles.orderDate, index === 0 && styles.orderDateInverse]}>
                    {formatDate(order.createdAt)} {order.status ? `\u00B7 ${order.status.replace(/_/g, " ")}` : ""}
                  </Text>
                </View>
                <Text style={[styles.orderAmount, index === 0 && styles.orderAmountInverse]}>
                  {symbol}{order.total.toFixed(2)}
                </Text>
              </View>

              <View style={[styles.orderItemsWrap, index === 0 && styles.orderItemsWrapFeatured]}>
                <Text style={[styles.orderItemsText, index === 0 && styles.orderItemsTextInverse]}>
                  {summarizeOrderItems(order)}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={handleMessageBuyer}
          activeOpacity={0.85}
          style={[styles.primaryButton, startingChat && styles.buttonDisabled]}
          disabled={startingChat}
        >
          <Text style={styles.primaryButtonText}>{startingChat ? "Opening chat..." : "Message Buyer"}</Text>
          <Ionicons name="paper-plane-outline" size={18} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push({ pathname: "/(vendor)/send-offer", params: { buyerId: profile.id } } as any)}
          activeOpacity={0.85}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Send Offer</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAF8" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E9ECEA",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 20, fontFamily: "Manrope-Bold", color: "#282828" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center" },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 132 },
  heroCard: {
    backgroundColor: "#1E2421",
    borderRadius: 28,
    padding: 20,
    marginBottom: 24,
  },
  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  heroCopy: { flex: 1 },
  heroName: { fontSize: 28, lineHeight: 34, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  heroMeta: { fontSize: 14, lineHeight: 20, fontFamily: "Outfit-Regular", color: "rgba(255,255,255,0.78)", marginTop: 8 },
  heroBadge: {
    marginTop: 14,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroBadgeText: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#FFFFFF" },
  avatarWrap: {
    width: 108,
    height: 108,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarRing: {
    position: "absolute",
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    opacity: 0.92,
  },
  avatarInner: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#D7EDE4",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: { fontSize: 28, fontFamily: "Manrope-Bold", color: "#076B51" },
  avatarImage: { width: 108, height: 108, borderRadius: 54, borderWidth: 4, borderColor: "#FFFFFF" },
  heroFooter: { marginTop: 18 },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  heroPillText: { flex: 1, fontSize: 13, fontFamily: "Outfit-Regular", color: "#D8E6E0" },
  sectionTitle: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 12 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginBottom: 24 },
  statCard: {
    width: "48%",
    minHeight: 150,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderWidth: 1,
    borderColor: "#EEF1EF",
  },
  statCardGreen: { backgroundColor: "#076B51", borderColor: "#076B51" },
  statCardDark: { backgroundColor: "#202320", borderColor: "#202320" },
  statIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(7,107,81,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  statIconWrapGreen: { backgroundColor: "rgba(255,255,255,0.16)" },
  statIconWrapDark: { backgroundColor: "rgba(255,255,255,0.12)" },
  statLabel: { fontSize: 13, lineHeight: 18, fontFamily: "Outfit-Regular", color: "#687076" },
  statLabelInverse: { color: "rgba(255,255,255,0.72)" },
  statValue: { fontSize: 22, lineHeight: 28, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 6 },
  statValueInverse: { color: "#FFFFFF" },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#EEF1EF",
    padding: 18,
    alignItems: "flex-start",
    gap: 10,
  },
  emptyCardTitle: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828" },
  emptyCardBody: { fontSize: 13, lineHeight: 19, fontFamily: "Outfit-Regular", color: "#687076" },
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#EEF1EF",
    padding: 18,
    marginBottom: 12,
  },
  orderCardFeatured: {
    backgroundColor: "#111111",
    borderColor: "#111111",
  },
  orderCardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  orderLabel: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828" },
  orderLabelInverse: { color: "#FFFFFF" },
  orderDate: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#687076", marginTop: 4 },
  orderDateInverse: { color: "rgba(255,255,255,0.68)" },
  orderAmount: { fontSize: 22, fontFamily: "Manrope-Bold", color: "#282828" },
  orderAmountInverse: { color: "#FFFFFF" },
  orderItemsWrap: {
    marginTop: 16,
    backgroundColor: "#F7F8F7",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  orderItemsWrapFeatured: { backgroundColor: "rgba(255,255,255,0.08)" },
  orderItemsText: { fontSize: 14, lineHeight: 20, fontFamily: "Outfit-Regular", color: "#394047" },
  orderItemsTextInverse: { color: "#E7ECEA" },
  bottomBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#076B51",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonDisabled: { opacity: 0.65 },
  primaryButtonText: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  secondaryButton: {
    height: 56,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#DCE5E0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
});
