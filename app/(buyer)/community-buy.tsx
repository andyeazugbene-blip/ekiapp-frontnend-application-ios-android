import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import { useFocusRefresh } from "../../hooks/useFocusRefresh";
import {
  EmptyState,
  ErrorState,
  FloatingCard,
  LoadingBlock,
  PremiumHeader,
  RangeProgressBar,
  StatusPill,
  premiumStyles,
} from "../../components/shared/PremiumBlocks";
import {
  communityBuyService,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_TONE,
  CONTRIBUTION_STATUS_LABELS,
  CONTRIBUTION_STATUS_TONE,
  type Campaign,
  type MyCommunityBuy,
} from "../../services/communityBuyService";
import { countryDisplayName } from "../../utils/countries";
import { calculateBuyerServiceFee } from "../../utils/communityBuyFees";
import { getDraftProgress } from "../../utils/campaignDraftProgress";
import { useAuthStore } from "../../stores/authStore";

function daysLeft(deadline: string | null): string {
  if (!deadline) return "";
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "Closing";
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return days === 1 ? "1 day left" : `${days} days left`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// Community Buy Workstream 2 — unified Home (spec §4.1): Discover, Joined,
// Organised and Drafts as tabs of one shared section, Create always
// visible, instead of 3 separate screens with no shared entry point.
// Organised/Drafts share one backend list (listMyOrganiserCampaigns) split
// client-side by status — the full per-organiser list is real data, not
// paginated or large enough to warrant a second endpoint.
type HomeTab = "discover" | "joined" | "organised" | "drafts";
const DRAFT_STATUSES = new Set(["DRAFT", "CHANGES_REQUIRED"]);

export default function CommunityBuyDiscoveryScreen() {
  const router = useRouter();
  const { selectedCurrency } = useCurrencyStore();
  // `?tab=` lets another screen land here on a specific tab (e.g. right after
  // deleting a draft from inside the campaign form → back on Drafts).
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const initialTab: HomeTab = tabParam === "drafts" || tabParam === "organised" || tabParam === "joined" ? tabParam : "discover";
  const [activeTab, setActiveTab] = useState<HomeTab>(initialTab);

  // Client correction (original, still true for the UI itself): "Community
  // Buy is not categorised by country... the function cannot be: I am
  // looking for Community Buy, I am in Italy, I click Italy and see all
  // Community Buys there." There is still no clickable browse-by-country
  // chip row here — that part never changed.
  //
  // Client decision (2026-09-22, buyer-country acceptance fix): what DID
  // change is that Discover is no longer cross-border. The backend now
  // scopes every result to the authenticated buyer's own registered
  // country (server-side, from their real profile — never a value this
  // screen could send), so this call carries no country param at all
  // anymore; there is nothing left here to pass. Figma "Search yam, garri,
  // location" is one combined field — the backend matches title/
  // description/collectionCity for it.
  const [searchQuery, setSearchQuery] = useState("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(true);
  const [discoverError, setDiscoverError] = useState("");

  const [joined, setJoined] = useState<MyCommunityBuy[]>([]);
  const [joinedLoading, setJoinedLoading] = useState(false);
  const [joinedError, setJoinedError] = useState("");
  const [joinedLoaded, setJoinedLoaded] = useState(false);

  const [myCampaigns, setMyCampaigns] = useState<Campaign[]>([]);
  const [organisedLoading, setOrganisedLoading] = useState(false);
  const [organisedError, setOrganisedError] = useState("");
  const [organisedLoaded, setOrganisedLoaded] = useState(false);
  const organisedLoadedRef = useRef(false);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);

  const loadDiscover = useCallback(async () => {
    setDiscoverLoading(true);
    setDiscoverError("");
    try {
      setCampaigns(await communityBuyService.listLiveCampaigns(searchQuery || undefined));
    } catch (err) {
      setDiscoverError(err instanceof Error ? err.message : "Could not load Community Buy campaigns.");
    } finally {
      setDiscoverLoading(false);
    }
  }, [searchQuery]);

  const loadJoined = useCallback(async () => {
    setJoinedLoading(true);
    setJoinedError("");
    try {
      setJoined(await communityBuyService.listMyContributions());
      setJoinedLoaded(true);
    } catch (err) {
      setJoinedError(err instanceof Error ? err.message : "Could not load your Community Buys.");
    } finally {
      setJoinedLoading(false);
    }
  }, []);

  // `silent` refreshes an already-shown list in place (no spinner swap, no
  // error banner replacing rows the user can already see) — used when
  // coming back to this screen after creating/editing/deleting a draft.
  const loadOrganised = useCallback(async (silent = false) => {
    if (!silent) {
      setOrganisedLoading(true);
      setOrganisedError("");
    }
    try {
      setMyCampaigns(await communityBuyService.listMyOrganiserCampaigns());
      setOrganisedLoaded(true);
      organisedLoadedRef.current = true;
    } catch (err) {
      if (!silent) setOrganisedError(err instanceof Error ? err.message : "Could not load your campaigns.");
    } finally {
      if (!silent) setOrganisedLoading(false);
    }
  }, []);

  // The 30s stale-gate in useFocusRefresh is right for Discover, but wrong for
  // drafts: creating, editing or deleting one happens on the *next* screen, so
  // a list fetched a few seconds earlier is already out of date the moment
  // the user comes back. Refresh it on every return instead.
  useFocusEffect(
    useCallback(() => {
      if (organisedLoadedRef.current) void loadOrganised(true);
    }, [loadOrganised]),
  );

  const handleDeleteDraft = (draft: Campaign) => {
    if (deletingDraftId) return;
    Alert.alert(
      "Delete this draft?",
      `"${draft.title || "Untitled draft"}" will be permanently deleted. This can't be undone.`,
      [
        { text: "Keep draft", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingDraftId(draft.id);
            try {
              await communityBuyService.deleteDraft(draft.id);
              setMyCampaigns((prev) => prev.filter((c) => c.id !== draft.id));
            } catch (err) {
              Alert.alert("Couldn't delete draft", err instanceof Error ? err.message : "Please try again.");
              // The failure may mean it's already gone or has moved on
              // (e.g. submitted elsewhere) — re-sync rather than leave a stale row.
              void loadOrganised(true);
            } finally {
              setDeletingDraftId(null);
            }
          },
        },
      ],
    );
  };

  const refreshActiveTab = useCallback(() => {
    if (activeTab === "discover") return loadDiscover();
    if (activeTab === "joined") return loadJoined();
    return loadOrganised();
  }, [activeTab, loadDiscover, loadJoined, loadOrganised]);

  useFocusRefresh(refreshActiveTab);

  const handleTabPress = (tab: HomeTab) => {
    setActiveTab(tab);
    if (tab === "joined" && !joinedLoaded) void loadJoined();
    if ((tab === "organised" || tab === "drafts") && !organisedLoaded) void loadOrganised();
  };

  useEffect(() => {
    if (tabParam === "drafts" || tabParam === "organised" || tabParam === "joined") handleTabPress(tabParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);

  const organisedCampaigns = myCampaigns.filter((c) => !DRAFT_STATUSES.has(c.status));
  const draftCampaigns = myCampaigns.filter((c) => DRAFT_STATUSES.has(c.status));

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader
        title={activeTab === "discover" ? "Explore Community Buys" : "Community Buy"}
        subtitle={activeTab === "discover" ? "Find campaigns in your area." : "Bulk-buy together, unlock better prices"}
        onBack={() => goBackOrReplace(router, "/(buyer)/profile" as any)}
        right={
          <View style={{ flexDirection: "row", gap: 8 }}>
            {/* my-community-buys.tsx has no other persistent entry point —
                without this it's only reachable via the one-time post-charge
                confirmation redirect, so returning buyers had no way back in. */}
            <TouchableOpacity
              onPress={() => router.push("/(buyer)/my-community-buys" as any)}
              activeOpacity={0.85}
              style={styles.headerIconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="My Community Buys"
            >
              <Ionicons name="receipt-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/(buyer)/community-buy-organiser-campaign" as any)}
              activeOpacity={0.85}
              style={styles.headerIconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Create a campaign"
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        }
      >
        <View style={styles.tabRow}>
          {([
            ["discover", "Discover"],
            ["joined", "Joined"],
            ["organised", "Organised"],
            ["drafts", "Drafts"],
          ] as const).map(([tab, label]) => (
            <TouchableOpacity
              key={tab}
              onPress={() => handleTabPress(tab)}
              activeOpacity={0.85}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: activeTab === tab }}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === "discover" ? (
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.7)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search yam, garri, location"
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => void loadDiscover()}
              returnKeyType="search"
              accessibilityLabel="Search yam, garri, location"
            />
          </View>
        ) : null}
      </PremiumHeader>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        {activeTab === "discover" ? (
          discoverLoading ? (
            <LoadingBlock />
          ) : discoverError ? (
            <View style={premiumStyles.block}><ErrorState message={discoverError} onRetry={() => void loadDiscover()} /></View>
          ) : campaigns.length === 0 ? (
            <View style={premiumStyles.block}>
              <FloatingCard>
                <EmptyState icon="people-circle-outline" title="No live campaigns right now" body="Check back soon, or start your own as an organiser." />
              </FloatingCard>
            </View>
          ) : (
            <View style={[premiumStyles.block, { gap: 10 }]}>
              {campaigns.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: "/(buyer)/community-buy-campaign", params: { id: c.id } } as any)}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.title}, ${countryDisplayName(c.country)}, ${daysLeft(c.deadline)}`}
                >
                  <FloatingCard style={{ gap: 8 }}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{c.title}</Text>
                      <View style={styles.countryPill}><Text style={styles.countryPillText}>{countryDisplayName(c.country)}</Text></View>
                    </View>
                    <Text style={styles.cardVendor}>
                      Organised by {c.organiserDisplayName ?? "Community organiser"}{c.organiserVerified ? " · Verified" : ""}
                    </Text>
                    {c.pricePerShareMinor != null ? (
                      <Text style={styles.cardMetaText}>
                        {c.quantityPerOrder && c.unit ? `${c.quantityPerOrder} ${c.unit} per slot · ` : ""}
                        {formatDisplayMoney(c.pricePerShareMinor / 100, c.currency, selectedCurrency)} per slot
                      </Text>
                    ) : null}
                    <RangeProgressBar value={c.confirmedShares} min={c.minimumShares!} goal={c.goalShares!} max={c.maximumShares!} />
                    <View style={styles.cardMetaRow}>
                      <Text style={styles.cardMetaText}>
                        {c.minimumShares} minimum · {Math.max(0, c.maximumShares! - c.confirmedShares)} spaces left
                      </Text>
                      <Text style={styles.cardMetaText}>{daysLeft(c.deadline)}</Text>
                    </View>
                    {c.collectionCity ? <Text style={styles.cardMetaText}>Collection in {c.collectionCity}</Text> : null}
                  </FloatingCard>
                </TouchableOpacity>
              ))}
            </View>
          )
        ) : activeTab === "joined" ? (
          joinedLoading ? (
            <LoadingBlock />
          ) : joinedError ? (
            <View style={premiumStyles.block}><ErrorState message={joinedError} onRetry={() => void loadJoined()} /></View>
          ) : joined.length === 0 ? (
            <View style={premiumStyles.block}>
              <FloatingCard>
                <EmptyState icon="people-circle-outline" title="No contributions yet" body="Campaigns you contribute to will show up here." />
              </FloatingCard>
            </View>
          ) : (
            <View style={[premiumStyles.block, { gap: 10 }]}>
              {joined.map((item) => {
                // Same fee-inclusive total as the quantity/review/receipt
                // screens — totalPaid/totalPledged are product-subtotal-only
                // (see MyCommunityBuy backend contract), so the fee is added
                // here for display, mirroring calculateBuyerServiceFee's
                // existing default-rate preview path.
                const paidTotal = item.totalPaid > 0 ? item.totalPaid + calculateBuyerServiceFee(item.totalPaid) : 0;
                const pledgedTotal = item.totalPledged > 0 ? item.totalPledged + calculateBuyerServiceFee(item.totalPledged) : 0;
                return (
                <TouchableOpacity
                  key={item.campaign.id}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: "/(buyer)/community-buy-campaign", params: { id: item.campaign.id } } as any)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.campaign.title}, ${CAMPAIGN_STATUS_LABELS[item.campaign.status]}`}
                >
                  <FloatingCard style={{ gap: 8 }}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{item.campaign.title}</Text>
                      <StatusPill label={CAMPAIGN_STATUS_LABELS[item.campaign.status]} tone={CAMPAIGN_STATUS_TONE[item.campaign.status]} />
                    </View>
                    <Text style={styles.cardVendor}>{item.campaign.supplier?.vendor?.storeName ?? "Community Buy"}</Text>
                    {item.refundStatus ? <StatusPill label={CONTRIBUTION_STATUS_LABELS[item.refundStatus]} tone={CONTRIBUTION_STATUS_TONE[item.refundStatus]} /> : null}
                    {item.campaign.status === "LIVE" || item.campaign.status === "RESCUE_WINDOW" || item.campaign.status === "PAUSED" ? (
                      <>
                        <RangeProgressBar value={item.campaign.confirmedShares} min={item.campaign.minimumShares} goal={item.campaign.goalShares} max={item.campaign.maximumShares} />
                        <Text style={styles.cardMetaText}>
                          {item.campaign.confirmedShares} of {item.campaign.maximumShares} slots filled
                          {item.campaign.status === "RESCUE_WINDOW" && item.campaign.rescueEndsAt ? ` · Completion period ends ${formatDate(item.campaign.rescueEndsAt)}` : ` · ${daysLeft(item.campaign.deadline)}`}
                        </Text>
                      </>
                    ) : null}
                    <View style={styles.cardMetaRow}>
                      <Text style={styles.cardMetaText}>
                        {item.totalPaid > 0
                          ? `${item.totalQuantity} share${item.totalQuantity === 1 ? "" : "s"} · ${formatDisplayMoney(paidTotal / 100, item.campaign.currency, selectedCurrency)} charged (incl. Eki fee)`
                          : !item.refundStatus
                            ? CONTRIBUTION_STATUS_LABELS[item.latestContribution.status]
                            : `${formatDisplayMoney(pledgedTotal / 100, item.campaign.currency, selectedCurrency)} pledged — not charged`}
                      </Text>
                      <Text style={styles.cardMetaText}>{formatDate(item.campaign.deadline)}</Text>
                    </View>
                  </FloatingCard>
                </TouchableOpacity>
                );
              })}
            </View>
          )
        ) : (
          // organised / drafts share one loading source
          organisedLoading ? (
            <LoadingBlock />
          ) : organisedError ? (
            <View style={premiumStyles.block}><ErrorState message={organisedError} onRetry={() => void loadOrganised()} /></View>
          ) : (activeTab === "organised" ? organisedCampaigns : draftCampaigns).length === 0 ? (
            <View style={premiumStyles.block}>
              <FloatingCard>
                <EmptyState
                  icon="megaphone-outline"
                  title={activeTab === "organised" ? "No campaigns yet" : "No drafts yet"}
                  body={activeTab === "organised" ? "Campaigns you're organising and have submitted will show up here." : "Start a campaign — it saves as a draft here until you're ready to submit it."}
                />
              </FloatingCard>
            </View>
          ) : (
            <View style={[premiumStyles.block, { gap: 10 }]}>
              {(activeTab === "organised" ? organisedCampaigns : draftCampaigns).map((c) => {
                const isDraftCard = activeTab === "drafts";
                const openCampaign = () => router.push({ pathname: "/(buyer)/community-buy-organiser-campaign", params: { id: c.id } } as any);
                const progress = isDraftCard ? getDraftProgress(c) : null;
                const deleting = deletingDraftId === c.id;
                // Real product info from what's been saved so far — only the
                // parts that exist, never a placeholder standing in for a
                // value the organiser hasn't entered yet.
                const productBits = [
                  c.country ? countryDisplayName(c.country) : null,
                  c.pricePerShareMinor ? `${formatDisplayMoney(c.pricePerShareMinor / 100, c.currency, selectedCurrency)} / share` : null,
                  c.unit ? `per ${c.unit}` : null,
                ].filter(Boolean);
                return (
                  <View key={c.id}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={openCampaign}
                      disabled={deleting}
                      accessibilityRole="button"
                      accessibilityLabel={`${c.title || "Untitled draft"}, ${CAMPAIGN_STATUS_LABELS[c.status]}${isDraftCard ? ", continue editing" : ""}`}
                    >
                      <FloatingCard style={{ gap: 8, opacity: deleting ? 0.5 : 1 }}>
                        <View style={styles.cardTop}>
                          <Text style={styles.cardTitle} numberOfLines={1}>{c.title || "Untitled draft"}</Text>
                          <StatusPill label={CAMPAIGN_STATUS_LABELS[c.status]} tone={CAMPAIGN_STATUS_TONE[c.status]} />
                        </View>
                        {isDraftCard && productBits.length > 0 ? (
                          <Text style={styles.cardMetaText} numberOfLines={1}>{productBits.join(" · ")}</Text>
                        ) : null}
                        {c.minimumShares != null && c.maximumShares != null ? (
                          <Text style={styles.cardMetaText}>{isDraftCard ? `${c.minimumShares}–${c.maximumShares} shares` : `${c.confirmedShares} of ${c.maximumShares} shares · minimum ${c.minimumShares}`}</Text>
                        ) : (
                          <Text style={styles.cardMetaText}>Quantities not yet set</Text>
                        )}
                        <Text style={styles.cardMetaText}>{c.deadline ? `Closes ${formatDate(c.deadline)}` : "Deadline not yet set"}</Text>
                        {progress ? (
                          <Text style={styles.draftNextText}>
                            {progress.next ? `Next: ${progress.next.label}` : "All sections filled in — ready to review and submit"}
                            {c.status === "CHANGES_REQUIRED" && c.reviewNotes ? " · changes requested" : ""}
                          </Text>
                        ) : null}
                      </FloatingCard>
                    </TouchableOpacity>
                    {isDraftCard ? (
                      <View style={styles.draftActions}>
                        <TouchableOpacity
                          onPress={openCampaign}
                          disabled={deleting}
                          activeOpacity={0.85}
                          style={styles.draftContinueBtn}
                          accessibilityRole="button"
                          accessibilityLabel={`Continue editing ${c.title || "untitled draft"}`}
                        >
                          <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                          <Text style={styles.draftContinueText}>Continue</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteDraft(c)}
                          disabled={Boolean(deletingDraftId)}
                          activeOpacity={0.85}
                          style={[styles.draftDeleteBtn, Boolean(deletingDraftId) && !deleting && { opacity: 0.5 }]}
                          accessibilityRole="button"
                          accessibilityLabel={`Delete ${c.title || "untitled draft"}`}
                          accessibilityState={{ busy: deleting, disabled: Boolean(deletingDraftId) }}
                        >
                          {deleting ? <ActivityIndicator size="small" color="#D6552F" /> : <Ionicons name="trash-outline" size={16} color="#D6552F" />}
                          <Text style={styles.draftDeleteText}>{deleting ? "Deleting" : "Delete"}</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerIconBtn: { width: 38, height: 38, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  tabRow: { flexDirection: "row", gap: 6, marginTop: 14 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)" },
  tabActive: { backgroundColor: "#FFFFFF" },
  tabText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  tabTextActive: { color: "#076B51" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginTop: 12 },
  searchInput: { flex: 1, fontSize: 13, fontFamily: "Outfit-Regular", color: "#FFFFFF", padding: 0 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontFamily: "Manrope-Bold", color: "#151E1B" },
  countryPill: { backgroundColor: "#F4F6F5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  countryPillText: { fontSize: 10, fontFamily: "Manrope-Bold", color: "#6A7B72" },
  cardVendor: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72", marginTop: -4 },
  cardMetaRow: { flexDirection: "row", justifyContent: "space-between" },
  cardMetaText: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#151E1B" },
  draftNextText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  draftActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  draftContinueBtn: { flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: "#076B51", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  draftContinueText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  draftDeleteBtn: { minHeight: 42, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#F2D7D7", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  draftDeleteText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#D6552F" },
});
