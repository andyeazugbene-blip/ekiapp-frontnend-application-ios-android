import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { useFocusRefresh } from "../../hooks/useFocusRefresh";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
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
  BUYER_SUBSCRIPTION_STATUS_LABELS,
  type BuyerSubscription,
  type Renewal,
  type SubscriptionOffer,
} from "../../services/regularDeliveriesService";

type Tab = "offers" | "subscribers" | "renewals" | "calendar";

const SUBSCRIBER_FILTERS = ["Active", "Paused", "Payment attention", "Price approval", "Cancelled"] as const;
type SubscriberFilter = (typeof SUBSCRIBER_FILTERS)[number];

const RENEWAL_FILTERS: Record<string, Renewal["status"][] | null> = {
  All: null,
  "Stock confirmation": ["AWAITING_STOCK"],
  "Ready for payment": ["READY_FOR_PAYMENT", "PAYMENT_PROCESSING"],
  "Price approval": ["AWAITING_PRICE_APPROVAL"],
  "Payment attention": ["PAYMENT_FAILED"],
  Paid: ["ORDER_CREATED"],
};

const CALENDAR_FILTERS = { Today: 1, "This week": 7, "This month": 31 } as const;
type CalendarFilter = keyof typeof CALENDAR_FILTERS;

const ATTENTION_STATUSES: Renewal["status"][] = ["AWAITING_STOCK", "AWAITING_PRICE_APPROVAL", "PAYMENT_FAILED"];
const OPEN_STATUSES: Renewal["status"][] = ["SCHEDULED", ...ATTENTION_STATUSES, "READY_FOR_PAYMENT", "PAYMENT_PROCESSING"];

function subscriberEstimateMinor(s: BuyerSubscription): { amount: number; currency: string } {
  const gross = s.items.reduce((sum, item) => sum + item.product.priceInCents * item.quantity, 0);
  return {
    amount: Math.round(gross * (1 - (s.offer?.discountPercent ?? 0) / 100)),
    currency: s.items[0]?.product.currency ?? "GBP",
  };
}

function renewalEstimateMinor(r: Renewal): number {
  return r.subtotalAmount ?? r.items.reduce((sum, item) => sum + item.currentUnitPrice * item.quantity, 0);
}

function isWithinDays(value: string, days: number): boolean {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() + days - 1);
  return new Date(value) <= end;
}

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
  const [customerSearch, setCustomerSearch] = useState("");
  const [subscriberFilter, setSubscriberFilter] = useState<SubscriberFilter>("Active");
  const [renewalFilter, setRenewalFilter] = useState("All");
  const [calendarFilter, setCalendarFilter] = useState<CalendarFilter>("This month");

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
      setError(err instanceof Error ? err.message : "Could not load Foodstuff Subscriptions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusRefresh(load);

  const pauseNewSubscriptions = (offer: SubscriptionOffer) => {
    Alert.alert(
      "Pause new subscriptions?",
      "New buyers will not be able to create a Foodstuff Subscription.\n\nExisting subscriptions and already-scheduled renewals will continue unless affected products are separately paused.",
      [
        { text: "Keep offer live", style: "cancel" },
        { text: "Pause new subscriptions", onPress: () => void togglePublish(offer) },
      ],
    );
  };

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

  const attentionCount = renewals.filter((r) => ATTENTION_STATUSES.includes(r.status)).length;
  const money = (minor: number, currency: string) => formatDisplayMoney(minor / 100, currency, selectedCurrency);

  const activeSubscribers = subscribers.filter((s) => s.status === "ACTIVE");
  const openRenewals = renewals.filter((r) => OPEN_STATUSES.includes(r.status));
  const subscriptionsWithOpenRenewal = new Set(openRenewals.map((r) => r.subscriptionId));
  // A subscription with a renewal already open counts once, not twice.
  const upcomingCount = openRenewals.length + activeSubscribers.filter((s) => s.nextRenewalAt && !subscriptionsWithOpenRenewal.has(s.id)).length;
  // Amounts in different currencies are never added together.
  const upcomingByCurrency = activeSubscribers.reduce<Record<string, number>>((totals, s) => {
    const { amount, currency } = subscriberEstimateMinor(s);
    totals[currency] = (totals[currency] ?? 0) + amount;
    return totals;
  }, {});
  const upcomingValue = Object.entries(upcomingByCurrency).map(([currency, amount]) => money(amount, currency)).join(" + ") || money(0, "GBP");

  const priceApprovalSubscriptionIds = new Set(renewals.filter((r) => r.status === "AWAITING_PRICE_APPROVAL").map((r) => r.subscriptionId));
  const matchesSubscriberFilter = (s: BuyerSubscription): boolean => {
    switch (subscriberFilter) {
      case "Active": return s.status === "ACTIVE";
      case "Paused": return s.status === "PAUSED";
      case "Payment attention": return s.status === "PAYMENT_ATTENTION";
      case "Price approval": return priceApprovalSubscriptionIds.has(s.id);
      case "Cancelled": return s.status === "CANCELLED";
    }
  };
  const query = customerSearch.trim().toLowerCase();
  const visibleSubscribers = subscribers.filter((s) => matchesSubscriberFilter(s) && (!query || (s.buyer?.name ?? "").toLowerCase().includes(query)));
  const renewalStatuses = RENEWAL_FILTERS[renewalFilter];
  const visibleRenewals = renewalStatuses ? renewals.filter((r) => renewalStatuses.includes(r.status)) : renewals;
  const calendarRenewals = renewals.filter((r) => OPEN_STATUSES.includes(r.status) && isWithinDays(r.cycleDate, CALENDAR_FILTERS[calendarFilter]));

  const renderFilterRow = (options: readonly string[], selected: string, onSelect: (value: string) => void) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
      {options.map((option) => (
        <TouchableOpacity
          key={option}
          onPress={() => onSelect(option)}
          activeOpacity={0.85}
          style={[styles.filterChip, selected === option && styles.filterChipActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: selected === option }}
        >
          <Text style={[styles.filterChipText, selected === option && styles.filterChipTextActive]}>{option}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader
        title="Foodstuff Subscriptions"
        subtitle="Let buyers subscribe to repeat foodstuff deliveries from your store."
        onBack={() => goBackOrReplace(router, "/(vendor)" as any)}
        right={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={() => router.push("/(vendor)/regular-delivery-insights" as any)} activeOpacity={0.85} style={styles.headerIconBtn} accessibilityRole="button" accessibilityLabel="View insights">
              <Ionicons name="stats-chart-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/(vendor)/regular-delivery-offer-edit" as any)} activeOpacity={0.85} style={[styles.headerIconBtn, { backgroundColor: "#FFFFFF" }]} accessibilityRole="button" accessibilityLabel="Create Foodstuff Subscription offer">
              <Ionicons name="add" size={20} color="#076B51" />
            </TouchableOpacity>
          </View>
        }
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRowContent}>
          {(["offers", "subscribers", "renewals", "calendar"] as Tab[]).map((t) => (
            <TouchableOpacity key={t} onPress={() => setTab(t)} activeOpacity={0.85} style={[styles.tabBtn, tab === t && styles.tabBtnActive]}>
              <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
                {t === "offers" ? "Offers" : t === "subscribers" ? "Customers" : t === "renewals" ? `Renewals${attentionCount > 0 ? ` · ${attentionCount}` : ""}` : "Calendar"}
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
                <FloatingCard style={{ gap: 12 }}>
                  <EmptyState icon="pricetags-outline" title="Start offering Foodstuff Subscriptions" body="Let buyers subscribe to foodstuff they need regularly." />
                  <TouchableOpacity onPress={() => router.push("/(vendor)/regular-delivery-offer-edit" as any)} style={styles.smallBtn} accessibilityRole="button">
                    <Text style={styles.smallBtnText}>Create Foodstuff Subscription offer</Text>
                  </TouchableOpacity>
                </FloatingCard>
              ) : (
                <>
                  <View style={styles.summaryGrid}>
                    <SummaryCard label="Active subscribers" value={String(activeSubscribers.length)} />
                    <SummaryCard label="Upcoming renewals" value={String(upcomingCount)} />
                    <SummaryCard label="Renewals needing attention" value={String(attentionCount)} />
                    <SummaryCard label="Estimated upcoming value" value={upcomingValue} />
                  </View>
                  <Text style={styles.cardMeta}>This value is based on scheduled renewals and is not guaranteed revenue.</Text>
                  {attentionCount > 0 ? (
                    <FloatingCard style={{ gap: 8 }}>
                      <Text style={styles.cardTitle}>Renewals need attention</Text>
                      <Text style={styles.cardMeta}>{attentionCount} upcoming renewal{attentionCount === 1 ? "" : "s"} require{attentionCount === 1 ? "s" : ""} stock confirmation, price approval or payment action.</Text>
                      <TouchableOpacity onPress={() => setTab("renewals")} style={[styles.smallBtn, { alignSelf: "flex-start" }]} accessibilityRole="button">
                        <Text style={styles.smallBtnText}>Review renewals</Text>
                      </TouchableOpacity>
                    </FloatingCard>
                  ) : null}
                  {offers.map((offer) => (
                    <FloatingCard key={offer.id}>
                      <View style={styles.cardTop}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{offer.title}</Text>
                        <StatusPill label={offer.isActive ? "Live" : "Draft"} tone={offer.isActive ? "success" : "neutral"} />
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
                          accessibilityRole="button"
                        >
                          <Text style={styles.smallBtnOutlineText}>Manage offer</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          disabled={busyId === offer.id}
                          onPress={() => (offer.isActive ? pauseNewSubscriptions(offer) : void togglePublish(offer))}
                          style={styles.smallBtn}
                          accessibilityRole="button"
                        >
                          {busyId === offer.id ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.smallBtnText}>{offer.isActive ? "Pause new subscriptions" : "Publish offer"}</Text>}
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity disabled={busyId === `${offer.id}-renewals`} onPress={() => void toggleRenewalsPaused(offer)} style={[styles.smallBtnOutline, { marginTop: 8 }]} accessibilityRole="button">
                        {busyId === `${offer.id}-renewals` ? (
                          <ActivityIndicator size="small" color="#076B51" />
                        ) : (
                          <Text style={styles.smallBtnOutlineText}>{offer.renewalsPaused ? "Resume renewals" : "Pause renewals"}</Text>
                        )}
                      </TouchableOpacity>
                    </FloatingCard>
                  ))}
                </>
              )
            ) : tab === "subscribers" ? (
              <>
                <Text style={styles.sectionTitle}>Foodstuff Subscription customers</Text>
                <TextInput
                  value={customerSearch}
                  onChangeText={setCustomerSearch}
                  placeholder="Search customers"
                  placeholderTextColor="#8AA194"
                  style={styles.searchInput}
                  accessibilityLabel="Search customers"
                />
                {renderFilterRow(SUBSCRIBER_FILTERS, subscriberFilter, (value) => setSubscriberFilter(value as SubscriberFilter))}
                {visibleSubscribers.length === 0 ? (
                  <FloatingCard><EmptyState icon="people-outline" title="Your Foodstuff Subscription customers will appear here." /></FloatingCard>
                ) : (
                  visibleSubscribers.map((s) => {
                    const estimate = subscriberEstimateMinor(s);
                    return (
                      <TouchableOpacity
                        key={s.id}
                        activeOpacity={0.85}
                        onPress={() => router.push({ pathname: "/(vendor)/regular-delivery-subscriber-detail", params: { id: s.id } } as any)}
                        accessibilityRole="button"
                      >
                        <FloatingCard style={{ gap: 3 }}>
                          <View style={styles.cardTop}>
                            <Text style={styles.cardTitle}>{s.buyer?.name ?? "Buyer"}</Text>
                            <Ionicons name="chevron-forward" size={16} color="#C7D2CB" />
                          </View>
                          <Text style={styles.cardMeta}>Next renewal: {formatDate(s.nextRenewalAt)}</Text>
                          <Text style={styles.cardMeta}>Estimated value: {money(estimate.amount, estimate.currency)}</Text>
                          <Text style={styles.cardMeta}>Status: {priceApprovalSubscriptionIds.has(s.id) ? "Price approval" : BUYER_SUBSCRIPTION_STATUS_LABELS[s.status]}</Text>
                        </FloatingCard>
                      </TouchableOpacity>
                    );
                  })
                )}
              </>
            ) : tab === "renewals" ? (
              <>
                <Text style={styles.sectionTitle}>Upcoming renewals</Text>
                {renderFilterRow(Object.keys(RENEWAL_FILTERS), renewalFilter, setRenewalFilter)}
                {visibleRenewals.length === 0 ? (
                  <FloatingCard><EmptyState icon="repeat-outline" title="No renewals here" body="Upcoming renewal cycles for your customers will show up here." /></FloatingCard>
                ) : (
                  visibleRenewals.map((r) => (
                    <FloatingCard key={r.id} style={{ gap: 3 }}>
                      <Text style={styles.cardTitle}>{r.subscription?.buyer?.name ?? "Buyer"}</Text>
                      <Text style={styles.cardMeta}>Payment scheduled: {formatDate(r.cycleDate)}</Text>
                      <Text style={styles.cardMeta}>Estimated value: {money(renewalEstimateMinor(r), r.currency)}</Text>
                      <View style={{ marginTop: 6, flexDirection: "row" }}>
                        <StatusPill
                          label={RENEWAL_STATUS_LABELS[r.status]}
                          tone={r.status === "ORDER_CREATED" ? "success" : r.status === "PAYMENT_FAILED" ? "error" : "neutral"}
                        />
                      </View>
                      {r.status === "AWAITING_STOCK" ? (
                        <TouchableOpacity disabled={busyId === r.id} onPress={() => void confirmStock(r.id)} style={[styles.smallBtn, { alignSelf: "flex-start", marginTop: 10 }]} accessibilityRole="button">
                          {busyId === r.id ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.smallBtnText}>Confirm stock</Text>}
                        </TouchableOpacity>
                      ) : null}
                    </FloatingCard>
                  ))
                )}
              </>
            ) : (
              <>
                <Text style={styles.sectionTitle}>Renewal calendar</Text>
                {renderFilterRow(Object.keys(CALENDAR_FILTERS), calendarFilter, (value) => setCalendarFilter(value as CalendarFilter))}
                {calendarRenewals.length === 0 ? (
                  <FloatingCard><EmptyState icon="calendar-outline" title="No renewals scheduled" body="Upcoming renewal cycles will appear here grouped by date." /></FloatingCard>
                ) : (
                  Object.entries(
                    calendarRenewals.reduce<Record<string, typeof renewals>>((groups, r) => {
                      const key = formatDate(r.cycleDate);
                      (groups[key] ??= []).push(r);
                      return groups;
                    }, {}),
                  ).map(([dateLabel, group]) => (
                    <FloatingCard key={dateLabel} style={{ gap: 4 }}>
                      <Text style={styles.calendarDateLabel}>{dateLabel}</Text>
                      <Text style={styles.cardMeta}>{group.length} renewal{group.length === 1 ? "" : "s"}</Text>
                      <Text style={styles.cardMeta}>Estimated value: {group.map((r) => money(renewalEstimateMinor(r), r.currency)).join(" + ")}</Text>
                      <TouchableOpacity onPress={() => setTab("renewals")} style={[styles.smallBtnOutline, { alignSelf: "flex-start", marginTop: 6 }]} accessibilityRole="button">
                        <Text style={styles.smallBtnOutlineText}>Review renewals</Text>
                      </TouchableOpacity>
                    </FloatingCard>
                  ))
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <FloatingCard style={styles.summaryCard}>
      <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </FloatingCard>
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
  sectionTitle: { fontSize: 16, fontFamily: "Manrope-ExtraBold", color: "#12221A" },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryCard: { flexBasis: "47%", flexGrow: 1, gap: 4 },
  summaryValue: { fontSize: 19, fontFamily: "Manrope-ExtraBold", color: "#151E1B" },
  summaryLabel: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  searchInput: { backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8E4", paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontFamily: "Outfit-Regular", color: "#151E1B" },
  filterRow: { flexDirection: "row", gap: 8, paddingBottom: 2 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8E4" },
  filterChipActive: { backgroundColor: "#076B51", borderColor: "#076B51" },
  filterChipText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#516A60" },
  filterChipTextActive: { color: "#FFFFFF" },
  calendarDateLabel: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#151E1B" },
});
