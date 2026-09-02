import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import {
  regularDeliveriesService,
  FREQUENCY_LABELS,
  RENEWAL_STATUS_LABELS,
  type BuyerSubscription,
  type Renewal,
  type SubscriptionOffer,
} from "../../services/regularDeliveriesService";

type Tab = "offers" | "subscribers" | "renewals";

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function VendorRegularDeliveriesScreen() {
  const router = useRouter();
  const { selectedCurrency } = useCurrencyStore();
  const [tab, setTab] = useState<Tab>("offers");

  const [offers, setOffers] = useState<SubscriptionOffer[]>([]);
  const [subscribers, setSubscribers] = useState<BuyerSubscription[]>([]);
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [offerList, subscriberList, renewalList] = await Promise.all([
        regularDeliveriesService.listMyOffers(),
        regularDeliveriesService.listMySubscribers(),
        regularDeliveriesService.listMyRenewals(),
      ]);
      setOffers(offerList);
      setSubscribers(subscriberList);
      setRenewals(renewalList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Regular Deliveries.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const togglePublish = async (offer: SubscriptionOffer) => {
    setBusyId(offer.id);
    try {
      const updated = offer.isActive
        ? await regularDeliveriesService.unpublishOffer(offer.id)
        : await regularDeliveriesService.publishOffer(offer.id);
      setOffers((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (err) {
      Alert.alert("Couldn't update offer", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const confirmStock = async (renewalId: string) => {
    setBusyId(renewalId);
    try {
      await regularDeliveriesService.confirmRenewalStock(renewalId);
      await load();
    } catch (err) {
      Alert.alert("Couldn't confirm stock", err instanceof Error ? err.message : "Some items may be out of stock.");
    } finally {
      setBusyId(null);
    }
  };

  const pendingStockCount = renewals.filter((r) => r.status === "AWAITING_STOCK").length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Regular Deliveries</Text>
        <TouchableOpacity onPress={() => router.push("/(vendor)/regular-delivery-offer-edit" as any)} activeOpacity={0.85} style={styles.addButton}>
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        {(["offers", "subscribers", "renewals"] as Tab[]).map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} activeOpacity={0.85} style={[styles.tabBtn, tab === t && styles.tabBtnActive]}>
            <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
              {t === "offers" ? "Offers" : t === "subscribers" ? "Subscribers" : `Renewals${pendingStockCount > 0 ? ` (${pendingStockCount})` : ""}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.placeholder}><ActivityIndicator color="#076B51" /></View>
        ) : error ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={28} color="#D6552F" />
            <Text style={styles.emptyTitle}>Couldn't load this</Text>
            <Text style={styles.emptyText}>{error}</Text>
            <TouchableOpacity onPress={() => void load()} activeOpacity={0.86} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : tab === "offers" ? (
          offers.length === 0 ? (
            <EmptyTab icon="pricetags-outline" title="No offers yet" text="Create a Regular Delivery offer to let buyers subscribe to recurring orders." />
          ) : (
            offers.map((offer) => (
              <View key={offer.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{offer.title}</Text>
                  <View style={[styles.statusPill, { backgroundColor: offer.isActive ? "rgba(7,107,81,0.1)" : "#F4F4F4" }]}>
                    <Text style={[styles.statusPillText, { color: offer.isActive ? "#076B51" : "#858585" }]}>{offer.isActive ? "Published" : "Draft"}</Text>
                  </View>
                </View>
                <Text style={styles.cardMeta}>{offer.products.length} product{offer.products.length === 1 ? "" : "s"} · {offer.frequencies.map((f) => FREQUENCY_LABELS[f]).join(", ")}</Text>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: "/(vendor)/regular-delivery-offer-edit", params: { id: offer.id } } as any)}
                    style={styles.smallBtnOutline}
                  >
                    <Text style={styles.smallBtnOutlineText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity disabled={busyId === offer.id} onPress={() => void togglePublish(offer)} style={styles.smallBtn}>
                    {busyId === offer.id ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.smallBtnText}>{offer.isActive ? "Unpublish" : "Publish"}</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )
        ) : tab === "subscribers" ? (
          subscribers.length === 0 ? (
            <EmptyTab icon="people-outline" title="No subscribers yet" text="Buyers who start a Regular Delivery from your offers will show up here." />
          ) : (
            subscribers.map((s) => (
              <View key={s.id} style={styles.card}>
                <Text style={styles.cardTitle}>{s.buyer?.name ?? "Buyer"}</Text>
                <Text style={styles.cardMeta}>{FREQUENCY_LABELS[s.frequency]} · {s.status.replace("_", " ")} · Next: {formatDate(s.nextRenewalAt)}</Text>
              </View>
            ))
          )
        ) : renewals.length === 0 ? (
          <EmptyTab icon="repeat-outline" title="No renewals yet" text="Upcoming renewal cycles for your subscribers will show up here." />
        ) : (
          renewals.map((r) => (
            <View key={r.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{r.subscription?.buyer?.name ?? "Buyer"}</Text>
                <Text style={styles.cardMeta}>{formatDate(r.cycleDate)}</Text>
              </View>
              <Text style={styles.cardMeta}>{RENEWAL_STATUS_LABELS[r.status]}</Text>
              {r.status === "AWAITING_STOCK" ? (
                <TouchableOpacity disabled={busyId === r.id} onPress={() => void confirmStock(r.id)} style={[styles.smallBtn, { alignSelf: "flex-start", marginTop: 8 }]}>
                  {busyId === r.id ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.smallBtnText}>Confirm stock</Text>}
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function EmptyTab({ icon, title, text }: { icon: React.ComponentProps<typeof Ionicons>["name"]; title: string; text: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon} size={30} color="#076B51" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },
  header: { backgroundColor: "#FFFFFF", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Manrope-Bold", color: "#282828" },
  addButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  tabRow: { flexDirection: "row", backgroundColor: "#FFFFFF", paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  tabBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: "#F4F4F4" },
  tabBtnActive: { backgroundColor: "#076B51" },
  tabBtnText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#282828" },
  tabBtnTextActive: { color: "#FFFFFF" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 100, gap: 10 },
  placeholder: { paddingVertical: 60, alignItems: "center" },
  emptyState: { alignItems: "center", paddingVertical: 50, paddingHorizontal: 24, gap: 8 },
  emptyTitle: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  emptyText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", lineHeight: 18 },
  retryButton: { marginTop: 6, minHeight: 38, borderRadius: 12, borderWidth: 1, borderColor: "#076B51", paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  retryButtonText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14, gap: 6 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  cardMeta: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585" },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusPillText: { fontSize: 11, fontFamily: "Manrope-Bold" },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  smallBtn: { backgroundColor: "#076B51", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, alignItems: "center", justifyContent: "center" },
  smallBtnText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  smallBtnOutline: { borderWidth: 1, borderColor: "#DADADA", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, alignItems: "center", justifyContent: "center" },
  smallBtnOutlineText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#282828" },
});
