import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusRefresh } from "../../hooks/useFocusRefresh";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import {
  ErrorState,
  FloatingCard,
  IconAvatar,
  LoadingBlock,
  PremiumHeader,
  premiumStyles,
} from "../../components/shared/PremiumBlocks";
import {
  communityBuyService,
  type Campaign,
  type MarketConfig,
  type SupplierProfile,
} from "../../services/communityBuyService";
import { vendorService, type VendorMarket } from "../../services/vendorService";
import { countryDisplayName } from "../../utils/countries";

const STATUS_LABEL: Record<Campaign["status"], string> = {
  DRAFT: "Draft",
  UNDER_REVIEW: "Under review",
  CHANGES_REQUIRED: "Changes requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  LIVE: "Live",
  PAUSED: "Paused",
  RESCUE_WINDOW: "Needs more participants",
  SUCCEEDED: "Succeeded",
  FAILED: "Did not reach minimum",
  REFUNDING: "Refunding",
  FULFILLING: "Proceeding",
  COMPLETED: "Completed",
  FINANCIALLY_CLOSED: "Closed",
  CANCELLED: "Ended",
};

export default function VendorCommunityBuySupplierScreen() {
  const router = useRouter();
  const { selectedCurrency } = useCurrencyStore();

  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [markets, setMarkets] = useState<MarketConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [applying, setApplying] = useState<string | null>(null);
  const [applyError, setApplyError] = useState("");
  const [committing, setCommitting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [profileData, marketList, vendorMarkets] = await Promise.all([
        communityBuyService.getMySupplierProfile(),
        communityBuyService.listMarketConfigs().catch(() => [] as MarketConfig[]),
        vendorService.getMyMarkets().catch(() => [] as VendorMarket[]),
      ]);
      setProfile(profileData);
      // A vendor can only apply as a supplier for a market they're actually
      // assigned to (backend enforces this too) — showing every open market
      // regardless would just produce a confusing rejection on submit.
      const activeVendorCodes = new Set(vendorMarkets.filter((m) => m.enabled).map((m) => m.marketCode));
      setMarkets(marketList.filter((m) => m.supplierApplicationsEnabled && activeVendorCodes.has(m.countryCode)));
      if (profileData?.isVerified) {
        setCampaigns(await communityBuyService.listMySupplierCampaigns());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your supplier status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusRefresh(load);

  const handleApply = async (countryCode: string) => {
    setApplying(countryCode);
    setApplyError("");
    try {
      setProfile(await communityBuyService.applyAsSupplier(countryCode));
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : "Could not submit your application.");
    } finally {
      setApplying(null);
    }
  };

  /** Doc screens 115-117 — confirms the supplier can fulfil every confirmed quantity between the minimum and maximum before the organiser can submit for admin review. */
  const handleAcceptCampaign = async (campaignId: string) => {
    setCommitting(campaignId);
    try {
      await communityBuyService.confirmSupplierCommitment(campaignId);
      await load();
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : "Could not accept this campaign.");
    } finally {
      setCommitting(null);
    }
  };

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title="Community Buy" subtitle="Supplier dashboard" onBack={() => goBackOrReplace(router, "/(vendor)" as any)} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <View style={premiumStyles.block}><ErrorState message={error} onRetry={() => void load()} /></View>
        ) : !profile ? (
          <View style={[premiumStyles.block, { gap: 12 }]}>
            <FloatingCard style={styles.introCard}>
              <IconAvatar icon="people-circle-outline" tone="success" size={52} />
              <Text style={styles.introTitle}>Become a Community Buy supplier</Text>
              <Text style={styles.introBody}>
                Suppliers fulfil bulk orders raised by organisers in your market. Your store must already be verified. An admin reviews every application.
              </Text>
            </FloatingCard>
            {markets.length === 0 ? (
              <Text style={styles.emptyText}>Supplier applications aren't open in any market yet.</Text>
            ) : (
              <View style={{ gap: 8 }}>
                {markets.map((m) => (
                  <TouchableOpacity key={m.countryCode} disabled={applying === m.countryCode} onPress={() => void handleApply(m.countryCode)} activeOpacity={0.85}>
                    <FloatingCard style={styles.applyRow}>
                      <Text style={styles.applyRowText}>Apply for {countryDisplayName(m.countryCode)}</Text>
                      {applying === m.countryCode ? <ActivityIndicator size="small" color="#076B51" /> : <Ionicons name="chevron-forward" size={16} color="#8AA194" />}
                    </FloatingCard>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {applyError ? <Text style={styles.errorText}>{applyError}</Text> : null}
          </View>
        ) : !profile.isVerified ? (
          <View style={premiumStyles.block}>
            <FloatingCard style={styles.introCard}>
              <IconAvatar icon="time-outline" tone="warning" size={52} />
              <Text style={styles.introTitle}>Application under review</Text>
              <Text style={styles.introBody}>
                Your supplier application for {countryDisplayName(profile.country)} is being verified. You'll be notified once organisers can select you for a campaign.
              </Text>
            </FloatingCard>
          </View>
        ) : (
          <View style={[premiumStyles.block, { gap: 14 }]}>
            <Text style={styles.section}>Assigned campaigns</Text>
            {campaigns.length === 0 ? (
              <Text style={styles.emptyText}>No campaigns have selected you as supplier yet.</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {campaigns.map((c) => (
                  <FloatingCard key={c.id} style={{ gap: 4 }}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{c.title}</Text>
                      <Text style={styles.cardStatus}>{STATUS_LABEL[c.status]}</Text>
                    </View>
                    <Text style={styles.cardMeta}>
                      {c.confirmedShares} of {c.maximumShares} shares · minimum {c.minimumShares} to proceed
                    </Text>
                    <Text style={styles.cardMeta}>
                      {formatDisplayMoney(c.pricePerShareMinor / 100, c.currency, selectedCurrency)} per share
                    </Text>
                    {["DRAFT", "CHANGES_REQUIRED"].includes(c.status) && !c.supplierCommitted ? (
                      <TouchableOpacity
                        onPress={() => void handleAcceptCampaign(c.id)}
                        disabled={committing === c.id}
                        activeOpacity={0.88}
                        style={styles.acceptBtn}
                      >
                        {committing === c.id ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.acceptBtnText}>Confirm supply commitment</Text>}
                      </TouchableOpacity>
                    ) : c.supplierCommitted ? (
                      <View style={styles.committedRow}>
                        <Ionicons name="checkmark-circle" size={14} color="#076B51" />
                        <Text style={styles.committedText}>You've accepted this campaign</Text>
                      </View>
                    ) : null}
                    {["FULFILLING", "SUCCEEDED", "COMPLETED"].includes(c.status) ? (
                      <TouchableOpacity
                        onPress={() => router.push({ pathname: "/(vendor)/community-buy-supplier-fulfilment", params: { id: c.id } } as any)}
                        activeOpacity={0.88}
                        style={styles.acceptBtn}
                      >
                        <Text style={styles.acceptBtnText}>Manage fulfilment</Text>
                      </TouchableOpacity>
                    ) : null}
                  </FloatingCard>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  introCard: { alignItems: "center", gap: 8 },
  introTitle: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#151E1B" },
  introBody: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#6A7B72", textAlign: "center", lineHeight: 19 },
  applyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  applyRowText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
  errorText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#D6552F", textAlign: "center" },
  emptyText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#6A7B72", textAlign: "center", paddingVertical: 8 },
  section: { fontSize: 15, fontFamily: "Manrope-ExtraBold", color: "#12221A" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontFamily: "Manrope-Bold", color: "#151E1B" },
  cardStatus: { fontSize: 11, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  cardMeta: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  acceptBtn: { minHeight: 42, borderRadius: 12, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", marginTop: 6 },
  acceptBtnText: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  committedRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  committedText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#076B51" },
});
