import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
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
  type MarketConfig,
  type MyCommunityBuy,
} from "../../services/communityBuyService";
import { countryDisplayName } from "../../utils/countries";
import { calculateBuyerServiceFee } from "../../utils/communityBuyFees";

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
  const [activeTab, setActiveTab] = useState<HomeTab>("discover");

  const [markets, setMarkets] = useState<MarketConfig[]>([]);
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
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

  const loadDiscover = useCallback(async () => {
    setDiscoverLoading(true);
    setDiscoverError("");
    try {
      const [marketList, campaignList] = await Promise.all([
        communityBuyService.listMarketConfigs().catch(() => [] as MarketConfig[]),
        communityBuyService.listLiveCampaigns(countryFilter ?? undefined, searchQuery || undefined),
      ]);
      setMarkets(marketList.filter((m) => m.communityBuyEnabled));
      setCampaigns(campaignList);
    } catch (err) {
      setDiscoverError(err instanceof Error ? err.message : "Could not load Community Buy campaigns.");
    } finally {
      setDiscoverLoading(false);
    }
  }, [countryFilter, searchQuery]);

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

  const loadOrganised = useCallback(async () => {
    setOrganisedLoading(true);
    setOrganisedError("");
    try {
      setMyCampaigns(await communityBuyService.listMyOrganiserCampaigns());
      setOrganisedLoaded(true);
    } catch (err) {
      setOrganisedError(err instanceof Error ? err.message : "Could not load your campaigns.");
    } finally {
      setOrganisedLoading(false);
    }
  }, []);

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

  const organisedCampaigns = myCampaigns.filter((c) => !DRAFT_STATUSES.has(c.status));
  const draftCampaigns = myCampaigns.filter((c) => DRAFT_STATUSES.has(c.status));

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader
        title="Community Buy"
        subtitle="Bulk-buy together, unlock better prices"
        onBack={() => goBackOrReplace(router, "/(buyer)/profile" as any)}
        right={
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
          <>
            <View style={styles.searchRow}>
              <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.7)" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search campaigns"
                placeholderTextColor="rgba(255,255,255,0.6)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={() => void loadDiscover()}
                returnKeyType="search"
                accessibilityLabel="Search campaigns"
              />
            </View>
            {markets.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                <TouchableOpacity
                  onPress={() => setCountryFilter(null)}
                  activeOpacity={0.85}
                  style={[styles.chip, !countryFilter && styles.chipActive]}
                  accessibilityRole="button"
                  accessibilityLabel="All markets"
                  accessibilityState={{ selected: !countryFilter }}
                >
                  <Text style={[styles.chipText, !countryFilter && styles.chipTextActive]}>All markets</Text>
                </TouchableOpacity>
                {markets.map((m) => (
                  <TouchableOpacity
                    key={m.countryCode}
                    onPress={() => setCountryFilter(m.countryCode)}
                    activeOpacity={0.85}
                    style={[styles.chip, countryFilter === m.countryCode && styles.chipActive]}
                    accessibilityRole="button"
                    accessibilityLabel={countryDisplayName(m.countryCode)}
                    accessibilityState={{ selected: countryFilter === m.countryCode }}
                  >
                    <Text style={[styles.chipText, countryFilter === m.countryCode && styles.chipTextActive]}>{countryDisplayName(m.countryCode)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}
          </>
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
                  <FloatingCard style={{ gap: 10 }}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{c.title}</Text>
                      <View style={styles.countryPill}><Text style={styles.countryPillText}>{countryDisplayName(c.country)}</Text></View>
                    </View>
                    <Text style={styles.cardVendor}>{c.supplier?.vendor?.storeName ?? "Community Buy"}</Text>
                    <RangeProgressBar value={c.confirmedShares} min={c.minimumShares!} goal={c.goalShares!} max={c.maximumShares!} />
                    <View style={styles.cardMetaRow}>
                      <Text style={styles.cardMetaText}>Target {formatDisplayMoney(c.targetAmount / 100, c.currency, selectedCurrency)}</Text>
                      <Text style={styles.cardMetaText}>{daysLeft(c.deadline)}</Text>
                    </View>
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
              {(activeTab === "organised" ? organisedCampaigns : draftCampaigns).map((c) => (
                <TouchableOpacity
                  key={c.id}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: "/(buyer)/community-buy-organiser-campaign", params: { id: c.id } } as any)}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.title || "Untitled draft"}, ${CAMPAIGN_STATUS_LABELS[c.status]}`}
                >
                  <FloatingCard style={{ gap: 8 }}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{c.title || "Untitled draft"}</Text>
                      <StatusPill label={CAMPAIGN_STATUS_LABELS[c.status]} tone={CAMPAIGN_STATUS_TONE[c.status]} />
                    </View>
                    {c.minimumShares != null && c.maximumShares != null ? (
                      <Text style={styles.cardMetaText}>{c.confirmedShares} of {c.maximumShares} shares · minimum {c.minimumShares}</Text>
                    ) : (
                      <Text style={styles.cardMetaText}>Quantities not yet set</Text>
                    )}
                    <Text style={styles.cardMetaText}>{c.deadline ? `Closes ${formatDate(c.deadline)}` : "Deadline not yet set"}</Text>
                  </FloatingCard>
                </TouchableOpacity>
              ))}
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
  filterRow: { gap: 8, paddingTop: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.14)" },
  chipActive: { backgroundColor: "#FFFFFF" },
  chipText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  chipTextActive: { color: "#076B51" },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontFamily: "Manrope-Bold", color: "#151E1B" },
  countryPill: { backgroundColor: "#F4F6F5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  countryPillText: { fontSize: 10, fontFamily: "Manrope-Bold", color: "#6A7B72" },
  cardVendor: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72", marginTop: -4 },
  cardMetaRow: { flexDirection: "row", justifyContent: "space-between" },
  cardMetaText: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#151E1B" },
});
