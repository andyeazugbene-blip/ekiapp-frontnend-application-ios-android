import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import {
  EmptyState,
  ErrorState,
  FloatingCard,
  LoadingBlock,
  PremiumHeader,
  StatusPill,
  premiumStyles,
} from "../../components/shared/PremiumBlocks";
import {
  regularDeliveriesService,
  FREQUENCY_LABELS,
  VENDOR_RENEWAL_STATUS_LABELS as RENEWAL_STATUS_LABELS,
  type BuyerSubscription,
  type Renewal,
  type SubscriptionOffer,
} from "../../services/regularDeliveriesService";

type Tab = "offers" | "subscribers" | "renewals" | "calendar";

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function VendorRegularDeliveriesScreen() {
  const router = useRouter();
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

  const toggleRenewalsPaused = async (offer: SubscriptionOffer) => {
    setBusyId(`${offer.id}-renewals`);
    try {
      const updated = offer.renewalsPaused
        ? await regularDeliveriesService.resumeOfferRenewals(offer.id)
        : await regularDeliveriesService.pauseOfferRenewals(offer.id);
      setOffers((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (err) {
      Alert.alert("Couldn't update renewals", err instanceof Error ? err.message : "Please try again.");
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
    <View style={premiumStyles.page}>
      <PremiumHeader
        title="Regular Deliveries"
        subtitle={loading ? undefined : `${offers.length} offer${offers.length === 1 ? "" : "s"} · ${subscribers.length} subscriber${subscribers.length === 1 ? "" : "s"}`}
        onBack={() => goBackOrReplace(router, "/(vendor)" as any)}
        right={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={() => router.push("/(vendor)/regular-delivery-insights" as any)} activeOpacity={0.85} style={styles.headerIconBtn}>
              <Ionicons name="stats-chart-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/(vendor)/regular-delivery-offer-edit" as any)} activeOpacity={0.85} style={[styles.headerIconBtn, { backgroundColor: "#FFFFFF" }]}>
              <Ionicons name="add" size={20} color="#076B51" />
            </TouchableOpacity>
          </View>
        }
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRowContent}>
          {(["offers", "subscribers", "renewals", "calendar"] as Tab[]).map((t) => (
            <TouchableOpacity key={t} onPress={() => setTab(t)} activeOpacity={0.85} style={[styles.tabBtn, tab === t && styles.tabBtnActive]}>
              <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
                {t === "offers" ? "Offers" : t === "subscribers" ? "Subscribers" : t === "renewals" ? `Renewals${pendingStockCount > 0 ? ` · ${pendingStockCount}` : ""}` : "Calendar"}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </PremiumHeader>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <View style={premiumStyles.block}><ErrorState message={error} onRetry={() => void load()} /></View>
        ) : (
          <View style={[premiumStyles.block, { gap: 10 }]}>
            {tab === "offers" ? (
              offers.length === 0 ? (
                <FloatingCard><EmptyState icon="pricetags-outline" title="No offers yet" body="Create a Regular Delivery offer to let buyers subscribe to recurring orders." /></FloatingCard>
              ) : (
                offers.map((offer) => (
                  <FloatingCard key={offer.id}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{offer.title}</Text>
                      <StatusPill label={offer.isActive ? "Published" : "Draft"} tone={offer.isActive ? "success" : "neutral"} />
                    </View>
                    <Text style={styles.cardMeta}>{offer.products.length} product{offer.products.length === 1 ? "" : "s"} · {offer.frequencies.map((f) => FREQUENCY_LABELS[f]).join(", ")}</Text>
                    {offer.renewalsPaused ? (
                      <View style={styles.pausedBanner}>
                        <Ionicons name="pause-circle-outline" size={14} color="#B48A00" />
                        <Text style={styles.pausedBannerText}>Renewals paused — existing subscribers won't be charged until resumed.</Text>
                      </View>
                    ) : null}
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
                      <TouchableOpacity disabled={busyId === `${offer.id}-renewals`} onPress={() => void toggleRenewalsPaused(offer)} style={styles.smallBtnOutline}>
                        {busyId === `${offer.id}-renewals` ? (
                          <ActivityIndicator size="small" color="#076B51" />
                        ) : (
                          <Text style={styles.smallBtnOutlineText}>{offer.renewalsPaused ? "Resume" : "Pause"}</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </FloatingCard>
                ))
              )
            ) : tab === "subscribers" ? (
              subscribers.length === 0 ? (
                <FloatingCard><EmptyState icon="people-outline" title="No subscribers yet" body="Buyers who start a Regular Delivery from your offers will show up here." /></FloatingCard>
              ) : (
                subscribers.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    activeOpacity={0.85}
                    onPress={() => router.push({ pathname: "/(vendor)/regular-delivery-subscriber-detail", params: { id: s.id } } as any)}
                  >
                    <FloatingCard>
                      <View style={styles.cardTop}>
                        <Text style={styles.cardTitle}>{s.buyer?.name ?? "Buyer"}</Text>
                        <Ionicons name="chevron-forward" size={16} color="#C7D2CB" />
                      </View>
                      <Text style={styles.cardMeta}>{FREQUENCY_LABELS[s.frequency]} · {s.status.replace("_", " ")} · Next {formatDate(s.nextRenewalAt)}</Text>
                    </FloatingCard>
                  </TouchableOpacity>
                ))
              )
            ) : tab === "renewals" ? (
              renewals.length === 0 ? (
                <FloatingCard><EmptyState icon="repeat-outline" title="No renewals yet" body="Upcoming renewal cycles for your subscribers will show up here." /></FloatingCard>
              ) : (
                renewals.map((r) => (
                  <FloatingCard key={r.id}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardTitle}>{r.subscription?.buyer?.name ?? "Buyer"}</Text>
                      <Text style={styles.cardMeta}>{formatDate(r.cycleDate)}</Text>
                    </View>
                    <StatusPill
                      label={RENEWAL_STATUS_LABELS[r.status]}
                      tone={r.status === "ORDER_CREATED" ? "success" : r.status === "PAYMENT_FAILED" ? "error" : "neutral"}
                    />
                    {r.status === "AWAITING_STOCK" ? (
                      <TouchableOpacity disabled={busyId === r.id} onPress={() => void confirmStock(r.id)} style={[styles.smallBtn, { alignSelf: "flex-start", marginTop: 10 }]}>
                        {busyId === r.id ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.smallBtnText}>Confirm stock</Text>}
                      </TouchableOpacity>
                    ) : null}
                  </FloatingCard>
                ))
              )
            ) : renewals.length === 0 ? (
              <FloatingCard><EmptyState icon="calendar-outline" title="No renewals scheduled" body="Upcoming renewal cycles will appear here grouped by date." /></FloatingCard>
            ) : (
              Object.entries(
                renewals.reduce<Record<string, typeof renewals>>((groups, r) => {
                  const key = formatDate(r.cycleDate);
                  (groups[key] ??= []).push(r);
                  return groups;
                }, {}),
              ).map(([dateLabel, group]) => (
                <FloatingCard key={dateLabel}>
                  <Text style={styles.calendarDateLabel}>{dateLabel}</Text>
                  <View style={{ marginTop: 8, gap: 10 }}>
                    {group.map((r) => (
                      <View key={r.id} style={styles.calendarRow}>
                        <View style={[styles.activityDot, r.status === "ORDER_CREATED" && styles.activityDotSent, r.status === "PAYMENT_FAILED" && styles.activityDotFailed]} />
                        <Text style={styles.calendarRowText} numberOfLines={1}>{r.subscription?.buyer?.name ?? "Buyer"}</Text>
                        <Text style={styles.calendarRowStatus}>{RENEWAL_STATUS_LABELS[r.status]}</Text>
                      </View>
                    ))}
                  </View>
                </FloatingCard>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerIconBtn: { width: 38, height: 38, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  tabRowContent: { flexDirection: "row", gap: 8, marginTop: 16 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.12)" },
  tabBtnActive: { backgroundColor: "#FFFFFF" },
  tabBtnText: { fontSize: 12, fontFamily: "Manrope-Bold", color: "rgba(255,255,255,0.85)" },
  tabBtnTextActive: { color: "#076B51" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 },
  cardTitle: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#151E1B", flexShrink: 1 },
  cardMeta: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  smallBtn: { backgroundColor: "#076B51", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, alignItems: "center", justifyContent: "center" },
  smallBtnText: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  smallBtnOutline: { borderWidth: 1, borderColor: "#DCE3DF", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, alignItems: "center", justifyContent: "center" },
  smallBtnOutlineText: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#282828" },
  pausedBanner: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,197,0,0.14)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, marginTop: 8 },
  pausedBannerText: { flex: 1, fontSize: 11, fontFamily: "Outfit-Regular", color: "#8A6A00" },
  calendarDateLabel: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#151E1B" },
  calendarRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#C7D2CB" },
  activityDotSent: { backgroundColor: "#076B51" },
  activityDotFailed: { backgroundColor: "#D6552F" },
  calendarRowText: { flex: 1, fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#282828" },
  calendarRowStatus: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#6A7B72" },
});
