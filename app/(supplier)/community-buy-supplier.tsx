import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
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
  RangeProgressBar,
  StatusPill,
  premiumStyles,
  type Tone,
} from "../../components/shared/PremiumBlocks";
import {
  communityBuyService,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_TONE,
  SUPPLIER_ACCOUNT_STATE_LABELS,
  type Campaign,
  type MarketConfig,
  type SupplierAccount,
  type SupplierAccountState,
} from "../../services/communityBuyService";
import { countryDisplayName } from "../../utils/countries";
import { CountrySelectField } from "../../components/shared/CountrySelectField";
import { calculateSupplierCommission } from "../../utils/communityBuyFees";
import { getLaunchSettings } from "../../services/launchSettingsService";
import type { InventoryStatus } from "../../services/communityBuyService";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const UPDATE_POSTABLE_STATUSES = ["LIVE", "PAUSED", "RESCUE_WINDOW", "SUCCEEDED", "FAILED", "REFUNDING", "FULFILLING", "COMPLETED"];

// Mirrors the backend's SUPPLIER_RESPONSE_STATUSES (community-campaigns.service.ts) —
// client-corrected flow: a supplier can accept or decline at any point up
// to the campaign closing out, not only while it's still in draft/review.
const SUPPLIER_RESPONSE_STATUSES = ["DRAFT", "CHANGES_REQUIRED", "UNDER_REVIEW", "APPROVED", "LIVE", "PAUSED", "RESCUE_WINDOW"];

// Figma S15 — declineSupplierCommitment() already persists any string as
// declineReason; this is a fixed vocabulary sent through that same
// existing call, not a new backend enum.
const DECLINE_REASONS = [
  "I don't have enough capacity",
  "Product unavailable",
  "Pricing doesn't work",
  "I can't meet the date",
  "Delivery requirements",
  "Outside my coverage",
  "Other",
] as const;

// Workstream 3 — every state that still shows the campaign dashboard (the
// account has, at some point, been approved and isn't currently blocked).
// PAUSED/RESTRICTED both keep existing obligations visible (restriction
// only closes the door to new work) — SUSPENDED/CLOSED do not.
const DASHBOARD_VISIBLE_STATES: SupplierAccountState[] = ["APPROVED", "PAUSED", "RESTRICTED"];

// Spec F: Supplier Centre sections.
const INVENTORY_OPTIONS: [InventoryStatus, string][] = [["CONFIRMED", "Confirmed"], ["LIMITED", "Limited"], ["NO_LONGER_AVAILABLE", "No longer available"]];
type CentreSection = "home" | "invitations" | "campaigns" | "fulfilment" | "payouts";
const CENTRE_SECTIONS: { key: CentreSection; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "invitations", label: "Invitations" },
  { key: "campaigns", label: "Campaigns" },
  { key: "fulfilment", label: "Fulfilment" },
  { key: "payouts", label: "Payouts" },
];
const AFTER_CAPTURE_STATUSES = ["SUCCEEDED", "FULFILLING", "COMPLETED", "FINANCIALLY_CLOSED"];
const SECTION_EMPTY: Record<CentreSection, string> = {
  home: "",
  invitations: "No invitations are waiting for your answer.",
  campaigns: "Campaigns you've accepted will show up here.",
  fulfilment: "Campaigns appear here once they succeed and are ready to fulfil.",
  payouts: "Payouts appear here once a campaign you supplied has succeeded.",
};
const FULFILMENT_METHOD_OPTIONS = [
  { value: "DELIVERY", label: "Delivery" },
  { value: "COLLECTION", label: "Collection" },
];

// Community Buy Workstream 2: a campaign's deadline is nullable while
// still a draft — a supplier can be invited to (and see) a campaign
// before the organiser has finished the wizard (SUPPLIER_RESPONSE_
// STATUSES includes DRAFT/CHANGES_REQUIRED). `new Date(null)` silently
// resolves to the 1970 epoch rather than an invalid date, so the null
// check must come before constructing the Date, not rely on NaN alone.
function formatDeadline(value: string | null | undefined): string {
  if (!value) return "Not yet set";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function VendorCommunityBuySupplierScreen() {
  const router = useRouter();
  const { selectedCurrency } = useCurrencyStore();

  const [account, setAccount] = useState<SupplierAccount | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [markets, setMarkets] = useState<MarketConfig[]>([]);
  // Diaspora escrow reconciliation — keyed by country, unfiltered (unlike
  // `markets` above, which is deliberately narrowed to markets still open
  // for new applications and would wrongly omit a market an already-
  // approved supplier is still actively operating in).
  const [marketByCountry, setMarketByCountry] = useState<Record<string, MarketConfig>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Onboarding form (Workstream 3 — mandate item 2: real requirements, not
  // a one-tap "Apply for {country}") — country + categories + coverage.
  const [formCountry, setFormCountry] = useState<string | null>(null);
  const [inventoryChoice, setInventoryChoice] = useState<Record<string, InventoryStatus>>({});
  const [questionOpenId, setQuestionOpenId] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [hideMarketChoice, setHideMarketChoice] = useState(false);
  const [formCategories, setFormCategories] = useState("");
  const [formBusinessName, setFormBusinessName] = useState("");
  const [formRegistration, setFormRegistration] = useState("");
  const [formMethods, setFormMethods] = useState<string[]>([]);
  const [formCapacity, setFormCapacity] = useState("");
  const [section, setSection] = useState<CentreSection>("home");
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");

  const [connectingPayouts, setConnectingPayouts] = useState(false);
  const [togglingPause, setTogglingPause] = useState(false);

  const [committing, setCommitting] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [showDeclineFormId, setShowDeclineFormId] = useState<string | null>(null);
  const [declineReasonById, setDeclineReasonById] = useState<Record<string, string>>({});
  // Figma S15 — a fixed reason list, not free text alone; declineSupplierCommitment()
  // already accepts any string, so the chosen label + optional note is sent as-is,
  // no backend change needed.
  const [declineReasonChoiceById, setDeclineReasonChoiceById] = useState<Record<string, string>>({});
  const [showUpdateFormId, setShowUpdateFormId] = useState<string | null>(null);
  const [updateTitleById, setUpdateTitleById] = useState<Record<string, string>>({});
  const [updateMessageById, setUpdateMessageById] = useState<Record<string, string>>({});
  const [postingUpdate, setPostingUpdate] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [profileData, marketList] = await Promise.all([
        communityBuyService.getMySupplierProfile(),
        communityBuyService.listMarketConfigs().catch(() => [] as MarketConfig[]),
      ]);
      setAccount(profileData.account);
      // A re-application starts from what was already submitted.
      setFormBusinessName((current) => current || profileData.account?.businessName || "");
      setFormRegistration((current) => current || profileData.account?.businessRegistrationNumber || "");
      setFormMethods((current) => (current.length > 0 ? current : profileData.account?.fulfilmentMethods ?? []));
      setFormCategories((current) => current || (profileData.account?.categories ?? []).join(", "));
      // Workstream 3 fix: this used to also require the caller to already
      // have a Vendor with an active market assignment before ANY market
      // would show at all — exactly the no-Vendor-required onboarding this
      // workstream exists to fix. Every market open for supplier
      // applications is offered.
      setMarkets(marketList.filter((m) => m.supplierApplicationsEnabled));
      const launch = await getLaunchSettings();
      setHideMarketChoice(launch.ukLaunchMode);
      if (launch.ukLaunchMode) setFormCountry((current) => current ?? launch.launchMarket);
      if (profileData.account && DASHBOARD_VISIBLE_STATES.includes(profileData.account.supplierState)) {
        const myCampaigns = await communityBuyService.listMySupplierCampaigns();
        setCampaigns(myCampaigns);
        // Diaspora escrow reconciliation — only fetch the specific
        // countries these campaigns actually use, not the whole list.
        const countries = Array.from(new Set(myCampaigns.map((c) => c.country).filter((c): c is string => !!c)));
        const configs = await Promise.all(countries.map((code) => communityBuyService.getMarketConfig(code).catch(() => null)));
        setMarketByCountry(Object.fromEntries(configs.filter((c): c is MarketConfig => !!c).map((c) => [c.countryCode, c])));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your supplier status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusRefresh(load);

  const handleApply = async () => {
    if (!formCountry) {
      setApplyError("Choose a market first.");
      return;
    }
    // Admin approval is blocked while categories are empty (backend
    // computeRequirementsDue), so an empty form could never be approved.
    const categories = formCategories.split(",").map((c) => c.trim()).filter(Boolean);
    if (!formBusinessName.trim()) {
      setApplyError("Add your business name.");
      return;
    }
    if (categories.length === 0) {
      setApplyError("Add at least one category you can supply.");
      return;
    }
    if (formMethods.length === 0) {
      setApplyError("Choose how you can fulfil orders.");
      return;
    }
    const capacity = formCapacity.trim() ? Number(formCapacity) : undefined;
    if (capacity !== undefined && (!Number.isInteger(capacity) || capacity < 1)) {
      setApplyError("Daily capacity must be a whole number, or leave it blank.");
      return;
    }
    setApplying(true);
    setApplyError("");
    try {
      setAccount(await communityBuyService.applyAsSupplier({
        country: formCountry,
        categories,
        coverageRegions: [formCountry],
        businessName: formBusinessName.trim(),
        businessRegistrationNumber: formRegistration.trim() || undefined,
        fulfilmentMethods: formMethods,
        collectionCapacityPerDay: capacity,
      }));
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : "Could not submit your application.");
    } finally {
      setApplying(false);
    }
  };

  const handleConnectPayouts = async () => {
    setConnectingPayouts(true);
    try {
      const { onboardingUrl } = await communityBuyService.onboardSupplierStripeConnect();
      await Linking.openURL(onboardingUrl);
    } catch (err) {
      Alert.alert("Couldn't start payout setup", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setConnectingPayouts(false);
    }
  };

  /** M5 (spec §6.4 "paused: voluntarily unavailable for new work") — the only self-service SupplierAccount transition. */
  const handleTogglePause = async (currentlyPaused: boolean) => {
    setTogglingPause(true);
    try {
      if (currentlyPaused) await communityBuyService.resumeSupplierAccount();
      else await communityBuyService.pauseSupplierAccount();
      await load();
    } catch (err) {
      Alert.alert(currentlyPaused ? "Couldn't resume" : "Couldn't pause", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setTogglingPause(false);
    }
  };

  /** Doc screens 115-117 — confirms the supplier can fulfil every confirmed quantity between the minimum and maximum before the organiser can submit for admin review. */
  const handleReconfirm = (campaignId: string, action: "confirm" | "decline") => {
    communityBuyService
      .reconfirmSupply(campaignId, action)
      .then(() => load())
      .catch((err: unknown) => Alert.alert("That didn't work", err instanceof Error ? err.message : "Please try again."));
  };

  const saveInventory = async (campaignId: string) => {
    const status = inventoryChoice[campaignId];
    if (!status) return;
    try {
      await communityBuyService.setInventoryStatus(campaignId, status);
      setCampaigns((prev) => prev.map((c) => (c.id === campaignId ? { ...c, supplierInventoryStatus: status } : c)));
    } catch (err) {
      Alert.alert("Couldn't save inventory status", err instanceof Error ? err.message : "Please try again.");
    }
  };

  const sendQuestion = async (campaignId: string) => {
    try {
      await communityBuyService.askSupplierQuestion(campaignId, questionText.trim());
      setQuestionText("");
      setQuestionOpenId(null);
      Alert.alert("Question sent", "Our support team will reply in your support cases.");
    } catch (err) {
      Alert.alert("Couldn't send your question", err instanceof Error ? err.message : "Please try again.");
    }
  };

  const handleAcceptCampaign = (campaignId: string, title: string) => {
    Alert.alert(
      "Confirm supply commitment",
      `For "${title}", I confirm that:\n\n• The product details are accurate\n• I can fulfil every confirmed quantity between the minimum and maximum\n• The participant price remains valid across the approved range\n• I can meet the fulfilment date\n• My payout information is current\n\nAcceptance does not guarantee an order. The supplier order is created only if the campaign reaches its approved minimum.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm acceptance",
          onPress: async () => {
            setCommitting(campaignId);
            try {
              await communityBuyService.confirmSupplierCommitment(campaignId);
              await load();
            } catch (err) {
              Alert.alert("Couldn't accept this campaign", err instanceof Error ? err.message : "Please try again.");
            } finally {
              setCommitting(null);
            }
          },
        },
      ],
    );
  };

  const handleDeclineCampaign = async (campaignId: string) => {
    const reasonChoice = declineReasonChoiceById[campaignId];
    const note = declineReasonById[campaignId]?.trim();
    const reason = [reasonChoice, note].filter(Boolean).join(": ") || undefined;
    setDeclining(campaignId);
    try {
      await communityBuyService.declineSupplierCommitment(campaignId, reason);
      setShowDeclineFormId(null);
      await load();
    } catch (err) {
      Alert.alert("Couldn't decline this campaign", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setDeclining(null);
    }
  };

  const handlePostUpdate = async (campaignId: string) => {
    const title = updateTitleById[campaignId]?.trim();
    const message = updateMessageById[campaignId]?.trim();
    if (!title || !message) {
      Alert.alert("Title and message required", "Give participants both a title and a message.");
      return;
    }
    setPostingUpdate(campaignId);
    try {
      await communityBuyService.postCampaignUpdate(campaignId, title, message);
      setUpdateTitleById((prev) => ({ ...prev, [campaignId]: "" }));
      setUpdateMessageById((prev) => ({ ...prev, [campaignId]: "" }));
      setShowUpdateFormId(null);
      Alert.alert("Update posted", "Every participant has been notified.");
    } catch (err) {
      Alert.alert("Couldn't post this update", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setPostingUpdate(null);
    }
  };

  const renderApplicationForm = (intro: { title: string; body: string; icon: IoniconName; tone: Tone }) => (
    <View style={[premiumStyles.block, { gap: 12 }]}>
      <FloatingCard style={styles.introCard}>
        <IconAvatar icon={intro.icon} tone={intro.tone} size={52} />
        <Text style={styles.introTitle}>{intro.title}</Text>
        <Text style={styles.introBody}>{intro.body}</Text>
      </FloatingCard>
      {markets.length === 0 ? (
        <Text style={styles.emptyText}>Supplier applications aren't open in any market yet.</Text>
      ) : (
        <FloatingCard style={{ gap: 10 }}>
          <Text style={styles.formSection}>Business information</Text>
          <Text style={styles.formLabel}>Business name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Ade Foods Ltd"
            placeholderTextColor="#8AA194"
            value={formBusinessName}
            onChangeText={setFormBusinessName}
            accessibilityLabel="Business name"
          />
          <Text style={styles.formLabel}>Company registration number (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="If your business has one"
            placeholderTextColor="#8AA194"
            value={formRegistration}
            onChangeText={setFormRegistration}
            accessibilityLabel="Company registration number, optional"
          />

          <Text style={[styles.formSection, { marginTop: 8 }]}>Products and coverage</Text>
          {hideMarketChoice ? null : (
            <>
              <Text style={styles.formLabel}>Market</Text>
              <CountrySelectField
                options={markets.map((m) => ({ code: m.countryCode, name: countryDisplayName(m.countryCode) }))}
                value={formCountry || null}
                onSelect={setFormCountry}
                placeholder="Choose a market"
                sheetTitle="Select market"
                accessibilityLabel={formCountry ? `Market: ${countryDisplayName(formCountry)}` : "Choose a market"}
              />
            </>
          )}
          <Text style={styles.formLabel}>Categories you can supply</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Rice, Oil, Household staples"
            placeholderTextColor="#8AA194"
            value={formCategories}
            onChangeText={setFormCategories}
            accessibilityLabel="Categories, comma separated"
          />
          <Text style={styles.hint}>Separate each category with a comma.</Text>

          <Text style={[styles.formSection, { marginTop: 8 }]}>How you fulfil orders</Text>
          <Text style={styles.formLabel}>How you can fulfil orders</Text>
          <View style={styles.methodRow}>
            {FULFILMENT_METHOD_OPTIONS.map((option) => {
              const selected = formMethods.includes(option.value);
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setFormMethods((current) => (selected ? current.filter((m) => m !== option.value) : [...current, option.value]))}
                  activeOpacity={0.85}
                  style={[styles.methodChip, selected && styles.methodChipActive]}
                  accessibilityRole="checkbox"
                  accessibilityLabel={option.label}
                  accessibilityState={{ checked: selected }}
                >
                  <Ionicons name={selected ? "checkbox" : "square-outline"} size={18} color={selected ? "#076B51" : "#8AA194"} />
                  <Text style={styles.methodText}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.formLabel}>Orders you can handle per day (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 50"
            placeholderTextColor="#8AA194"
            keyboardType="number-pad"
            value={formCapacity}
            onChangeText={setFormCapacity}
            accessibilityLabel="Orders you can handle per day, optional"
          />
          <Text style={styles.hint}>Next you'll verify your business with Stripe, then Eki reviews your application.</Text>
          {applyError ? <Text style={styles.errorText}>{applyError}</Text> : null}
          <TouchableOpacity
            onPress={() => void handleApply()}
            disabled={applying || !formCountry}
            activeOpacity={0.88}
            style={[styles.acceptBtn, (applying || !formCountry) && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel="Submit application"
            accessibilityState={{ busy: applying, disabled: applying || !formCountry }}
          >
            {applying ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.acceptBtnText}>Submit application</Text>}
          </TouchableOpacity>
        </FloatingCard>
      )}
    </View>
  );

  const renderInfoState = (intro: { title: string; body: string; icon: IoniconName; tone: Tone }) => (
    <View style={premiumStyles.block}>
      <FloatingCard style={styles.introCard}>
        <IconAvatar icon={intro.icon} tone={intro.tone} size={52} />
        <Text style={styles.introTitle}>{intro.title}</Text>
        <Text style={styles.introBody}>{intro.body}</Text>
      </FloatingCard>
    </View>
  );

  const renderByState = () => {
    const state = account?.supplierState ?? "NOT_STARTED";
    switch (state) {
      case "NOT_STARTED":
      case "DRAFT":
        return renderApplicationForm({
          icon: "people-circle-outline",
          tone: "success",
          title: "Become a Community Buy supplier",
          body: "Suppliers fulfil bulk orders raised by organisers in your market. You don't need a retail store on Eki.",
        });
      case "VERIFICATION_REQUIRED":
        return renderApplicationForm({
          icon: "shield-checkmark-outline",
          tone: "info",
          title: "Verification required",
          body: "A few more details are needed before your application can be reviewed.",
        });
      case "INFORMATION_REQUIRED":
        return (
          <View style={{ gap: 12 }}>
            {renderInfoState({
              icon: "alert-circle-outline",
              tone: "warning",
              title: "More information needed",
              body: account?.reasonCode ?? "Eki needs more information before your application can proceed. Update and resubmit below.",
            })}
            {renderApplicationForm({
              icon: "create-outline",
              tone: "warning",
              title: "Update your application",
              body: "Resubmit with the requested details.",
            })}
          </View>
        );
      case "REJECTED":
        return (
          <View style={{ gap: 12 }}>
            {renderInfoState({
              icon: "alert-circle-outline",
              tone: "error",
              title: "Application not approved",
              body: account?.reasonCode ?? "Eki couldn't approve this application. You can correct your details and apply again.",
            })}
            {renderApplicationForm({
              icon: "create-outline",
              tone: "warning",
              title: "Apply again",
              body: "Update your details and resubmit.",
            })}
          </View>
        );
      case "UNDER_REVIEW": {
        const stripeDone = !!account?.detailsSubmitted && !!account?.payoutsEnabled;
        return (
          <View style={[premiumStyles.block, { gap: 12 }]}>
            <FloatingCard style={{ gap: 14 }}>
              <Text style={styles.introTitle}>Your application</Text>
              <View style={styles.stepRow}>
                <Ionicons name="checkmark-circle" size={20} color="#076B51" />
                <Text style={styles.stepText}>Application submitted</Text>
              </View>
              <View style={styles.stepRow}>
                <Ionicons name={stripeDone ? "checkmark-circle" : "ellipse-outline"} size={20} color={stripeDone ? "#076B51" : "#B7791F"} />
                <View style={{ flex: 1, gap: 8 }}>
                  <Text style={styles.stepText}>{stripeDone ? "Stripe verification complete" : "Verify your business with Stripe"}</Text>
                  {!stripeDone ? (
                    <>
                      <Text style={styles.cardMeta}>Needed before organisers can select you and before you can be paid.</Text>
                      <TouchableOpacity
                        onPress={() => void handleConnectPayouts()}
                        disabled={connectingPayouts}
                        activeOpacity={0.88}
                        style={[styles.acceptBtn, { marginTop: 0 }]}
                        accessibilityRole="button"
                        accessibilityLabel="Verify with Stripe"
                        accessibilityState={{ busy: connectingPayouts, disabled: connectingPayouts }}
                      >
                        {connectingPayouts ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.acceptBtnText}>Verify with Stripe</Text>}
                      </TouchableOpacity>
                    </>
                  ) : null}
                </View>
              </View>
              <View style={styles.stepRow}>
                <Ionicons name="time-outline" size={20} color="#B7791F" />
                <Text style={styles.stepText}>Eki is reviewing your application. We'll notify you when it's decided.</Text>
              </View>
            </FloatingCard>
          </View>
        );
      }
      case "SUSPENDED":
        return renderInfoState({
          icon: "close-circle-outline",
          tone: "error",
          title: "Supplier account suspended",
          body: account?.reasonCode ?? "Your supplier account has been suspended. Contact Eki support for details.",
        });
      case "CLOSED":
        return renderInfoState({
          icon: "lock-closed-outline",
          tone: "neutral",
          title: "Supplier account closed",
          body: "This supplier account is closed.",
        });
      case "APPROVED":
      case "PAUSED":
      case "RESTRICTED": {
        const isPending = (c: Campaign) => SUPPLIER_RESPONSE_STATUSES.includes(c.status) && !c.supplierCommitted && !c.supplierDeclinedAt;
        const invitations = campaigns.filter(isPending);
        const afterCapture = campaigns.filter((c) => AFTER_CAPTURE_STATUSES.includes(c.status));
        const accepted = campaigns.filter((c) => !isPending(c) && !AFTER_CAPTURE_STATUSES.includes(c.status));
        const sectionCampaigns = section === "invitations" ? invitations : section === "campaigns" ? accepted : section === "home" ? [] : afterCapture;
        const homeTiles: { key: CentreSection; label: string; count: number }[] = [
          { key: "invitations", label: "Invitations waiting", count: invitations.length },
          { key: "campaigns", label: "Active campaigns", count: accepted.length },
          { key: "fulfilment", label: "To fulfil", count: afterCapture.length },
        ];
        return (
          <View style={[premiumStyles.block, { gap: 14 }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionRow}>
              {CENTRE_SECTIONS.map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => setSection(key)}
                  activeOpacity={0.85}
                  style={[styles.sectionTab, section === key && styles.sectionTabActive]}
                  accessibilityRole="tab"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: section === key }}
                >
                  <Text style={[styles.sectionTabText, section === key && styles.sectionTabTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {section === "home" ? (
              <TouchableOpacity onPress={() => router.push("/(supplier)/bulk-offers" as any)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Supply bulk orders">
                <FloatingCard style={{ gap: 4 }}>
                  <Text style={styles.tileCount}>Supply bulk orders</Text>
                  <Text style={styles.tileLabel}>Publish a bulk offer that organisers can build a Community Buy on.</Text>
                </FloatingCard>
              </TouchableOpacity>
            ) : null}
            {section === "home" ? (
              <View style={styles.tileRow}>
                {homeTiles.map((tile) => (
                  <TouchableOpacity key={tile.key} onPress={() => setSection(tile.key)} activeOpacity={0.85} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={`${tile.label}: ${tile.count}`}>
                    <FloatingCard style={styles.tile}>
                      <Text style={styles.tileCount}>{tile.count}</Text>
                      <Text style={styles.tileLabel}>{tile.label}</Text>
                    </FloatingCard>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            {state === "PAUSED" ? (
              <FloatingCard style={styles.bannerCard}>
                <Ionicons name="pause-circle-outline" size={18} color="#B7791F" />
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.bannerText}>Your supplier account is paused{account?.reasonCode ? `: ${account.reasonCode}` : ""}. New campaign assignments are on hold.</Text>
                  <TouchableOpacity
                    onPress={() => void handleTogglePause(true)}
                    disabled={togglingPause}
                    activeOpacity={0.88}
                    style={[styles.acceptBtn, { marginTop: 0 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Resume taking on new work"
                    accessibilityState={{ busy: togglingPause, disabled: togglingPause }}
                  >
                    {togglingPause ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.acceptBtnText}>Resume</Text>}
                  </TouchableOpacity>
                </View>
              </FloatingCard>
            ) : null}
            {state === "RESTRICTED" ? (
              <FloatingCard style={styles.bannerCard}>
                <Ionicons name="warning-outline" size={18} color="#D6552F" />
                <Text style={styles.bannerText}>Your supplier account is restricted{account?.reasonCode ? `: ${account.reasonCode}` : ""}. You can't take on new campaigns, but existing ones are unaffected.</Text>
              </FloatingCard>
            ) : null}
            {state === "APPROVED" && section === "home" ? (
              <TouchableOpacity
                onPress={() => void handleTogglePause(false)}
                disabled={togglingPause}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Pause new work"
                accessibilityState={{ busy: togglingPause, disabled: togglingPause }}
                style={{ alignSelf: "flex-start" }}
              >
                <FloatingCard style={styles.bannerCard}>
                  <Ionicons name="pause-circle-outline" size={18} color="#076B51" />
                  {togglingPause ? <ActivityIndicator size="small" color="#076B51" /> : <Text style={styles.bannerText}>Pause new work — existing campaigns stay unaffected</Text>}
                </FloatingCard>
              </TouchableOpacity>
            ) : null}
            {!account?.payoutsEnabled && (section === "home" || section === "payouts") ? (
              <FloatingCard style={styles.bannerCard}>
                <Ionicons name="card-outline" size={18} color="#076B51" />
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.bannerText}>Set up payouts to receive settlement for your campaigns.</Text>
                  <TouchableOpacity
                    onPress={() => void handleConnectPayouts()}
                    disabled={connectingPayouts}
                    activeOpacity={0.88}
                    style={[styles.acceptBtn, { marginTop: 0 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Set up payouts"
                    accessibilityState={{ busy: connectingPayouts, disabled: connectingPayouts }}
                  >
                    {connectingPayouts ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.acceptBtnText}>Set up payouts</Text>}
                  </TouchableOpacity>
                </View>
              </FloatingCard>
            ) : null}

            {section === "home" ? null : sectionCampaigns.length === 0 ? (
              <Text style={styles.emptyText}>{SECTION_EMPTY[section]}</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {sectionCampaigns.map((c) => {
                  const pendingDecision = SUPPLIER_RESPONSE_STATUSES.includes(c.status) && !c.supplierCommitted && !c.supplierDeclinedAt;
                  const canPostUpdate = UPDATE_POSTABLE_STATUSES.includes(c.status);
                  return (
                    <FloatingCard key={c.id} style={{ gap: 6 }}>
                      <View style={styles.cardTop}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{c.title}</Text>
                        <StatusPill label={CAMPAIGN_STATUS_LABELS[c.status]} tone={CAMPAIGN_STATUS_TONE[c.status]} />
                      </View>
                      <Text style={styles.cardMeta}>Organiser: {c.organiser?.user?.name ?? "Unknown"}</Text>
                      {c.minimumShares != null ? <Text style={styles.cardMeta}>Minimum quantity: {c.minimumShares}</Text> : null}
                      {c.goalShares != null ? <Text style={styles.cardMeta}>Goal quantity: {c.goalShares}</Text> : null}
                      {c.maximumShares != null ? <Text style={styles.cardMeta}>Maximum quantity: {c.maximumShares}</Text> : null}
                      {c.description ? <Text style={styles.cardDescription}>{c.description}</Text> : null}
                      <Text style={styles.cardMeta}>Deadline: {formatDeadline(c.deadline)}</Text>
                      {c.status === "AWAITING_SUPPLIER_RECONFIRMATION" ? (
                        <View style={{ gap: 8, marginTop: 4 }}>
                          <Text style={styles.cardDescription}>Fewer shares than the minimum have a confirmed hold. Can you supply {c.reconfirmationQuantity ?? "the confirmed number of"} share{c.reconfirmationQuantity === 1 ? "" : "s"}? If not, every hold is released and nobody is charged.</Text>
                          <TouchableOpacity onPress={() => handleReconfirm(c.id, "confirm")} activeOpacity={0.85} style={styles.acceptBtn} accessibilityRole="button" accessibilityLabel="Accept final quantity">
                            <Text style={styles.acceptBtnText}>Accept final quantity</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleReconfirm(c.id, "decline")} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Decline final quantity">
                            <Text style={styles.cardMeta}>Decline</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                      {["LIVE", "PAUSED", "RESCUE_WINDOW", "UNDER_REVIEW", "APPROVED"].includes(c.status) ? (
                        <RangeProgressBar value={c.confirmedShares} min={c.minimumShares!} goal={c.goalShares!} max={c.maximumShares!} />
                      ) : null}
                      <Text style={styles.cardMeta}>
                        {c.maximumShares != null && c.minimumShares != null
                          ? `${c.confirmedShares} of ${c.maximumShares} shares · minimum ${c.minimumShares} to proceed`
                          : "Quantities not yet set by the organiser"}
                      </Text>
                      <Text style={styles.cardMeta}>
                        {c.pricePerShareMinor != null && c.currency
                          ? `${formatDisplayMoney(c.pricePerShareMinor / 100, c.currency, selectedCurrency)} per share`
                          : "Price not yet set by the organiser"}
                      </Text>

                      {pendingDecision && c.wholesaleAmountMinor != null && c.currency ? (() => {
                        const feeBps = marketByCountry[c.country ?? ""]?.communityBuyFeeBps ?? 800;
                        const { commissionAmount, netPayable } = calculateSupplierCommission(c.wholesaleAmountMinor, feeBps);
                        return (
                          <FloatingCard style={styles.wholesaleCard}>
                            <Text style={styles.wholesaleTitle}>Your settlement for this campaign</Text>
                            <View style={styles.previewRow}>
                              <Text style={styles.fieldHint}>Agreed wholesale amount</Text>
                              <Text style={styles.previewValue}>{formatDisplayMoney(c.wholesaleAmountMinor / 100, c.currency, selectedCurrency)}</Text>
                            </View>
                            <View style={styles.previewRow}>
                              <Text style={styles.fieldHint}>Eki supplier commission ({(feeBps / 100).toFixed(0)}%)</Text>
                              <Text style={styles.previewValue}>-{formatDisplayMoney(commissionAmount / 100, c.currency, selectedCurrency)}</Text>
                            </View>
                            <View style={[styles.previewRow, styles.wholesaleTotalRow]}>
                              <Text style={styles.wholesaleTotalLabel}>You receive</Text>
                              <Text style={styles.wholesaleTotalValue}>{formatDisplayMoney(netPayable / 100, c.currency, selectedCurrency)}</Text>
                            </View>
                          </FloatingCard>
                        );
                      })() : null}

                      {c.supplierCommitted && canPostUpdate ? (
                        <View style={{ gap: 6, marginTop: 4 }}>
                          <Text style={styles.formLabel}>Confirm campaign inventory</Text>
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                            {INVENTORY_OPTIONS.map(([value, label]) => {
                              const on = (inventoryChoice[c.id] ?? c.supplierInventoryStatus) === value;
                              return (
                                <TouchableOpacity key={value} onPress={() => setInventoryChoice((p) => ({ ...p, [c.id]: value }))} activeOpacity={0.85} style={[styles.declineBtn, on && { borderColor: "#076B51", backgroundColor: "#EBF5F0" }]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                                  <Text style={[styles.declineBtnText, on && { color: "#076B51" }]}>{label}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                          {inventoryChoice[c.id] && inventoryChoice[c.id] !== c.supplierInventoryStatus ? (
                            <TouchableOpacity onPress={() => void saveInventory(c.id)} activeOpacity={0.88} style={[styles.acceptBtn, { marginTop: 0 }]} accessibilityRole="button" accessibilityLabel="Save inventory status">
                              <Text style={styles.acceptBtnText}>Save inventory status</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      ) : null}

                      {pendingDecision ? (
                        <TouchableOpacity onPress={() => setQuestionOpenId(questionOpenId === c.id ? null : c.id)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Ask a question" accessibilityState={{ expanded: questionOpenId === c.id }}>
                          <Text style={[styles.cardMeta, { color: "#076B51" }]}>Ask a question</Text>
                        </TouchableOpacity>
                      ) : null}
                      {questionOpenId === c.id ? (
                        <View style={styles.inlineForm}>
                          <TextInput style={styles.input} placeholder="What would you like to know?" placeholderTextColor="#8AA194" value={questionText} onChangeText={setQuestionText} multiline accessibilityLabel="Your question" />
                          <TouchableOpacity onPress={() => void sendQuestion(c.id)} disabled={!questionText.trim()} activeOpacity={0.88} style={[styles.acceptBtn, { marginTop: 0 }, !questionText.trim() && { opacity: 0.5 }]} accessibilityRole="button" accessibilityLabel="Send question">
                            <Text style={styles.acceptBtnText}>Send question</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}

                      {pendingDecision ? (
                        <>
                          <View style={styles.decisionRow}>
                            <TouchableOpacity
                              onPress={() => handleAcceptCampaign(c.id, c.title)}
                              disabled={committing === c.id || declining === c.id}
                              activeOpacity={0.88}
                              style={[styles.acceptBtn, { flex: 1, marginTop: 0 }]}
                              accessibilityRole="button"
                              accessibilityLabel="Accept"
                              accessibilityState={{ busy: committing === c.id, disabled: committing === c.id || declining === c.id }}
                            >
                              {committing === c.id ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.acceptBtnText}>Accept</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => setShowDeclineFormId(showDeclineFormId === c.id ? null : c.id)}
                              disabled={committing === c.id || declining === c.id}
                              activeOpacity={0.88}
                              style={styles.declineBtn}
                              accessibilityRole="button"
                              accessibilityLabel="Decline"
                              accessibilityState={{ disabled: committing === c.id || declining === c.id, expanded: showDeclineFormId === c.id }}
                            >
                              <Text style={styles.declineBtnText}>Decline</Text>
                            </TouchableOpacity>
                          </View>
                          {showDeclineFormId === c.id ? (
                            <View style={styles.inlineForm}>
                              <Text style={styles.hint}>Why are you declining?</Text>
                              {DECLINE_REASONS.map((reason) => (
                                <TouchableOpacity
                                  key={reason}
                                  onPress={() => setDeclineReasonChoiceById((prev) => ({ ...prev, [c.id]: reason }))}
                                  activeOpacity={0.85}
                                  style={styles.declineReasonRow}
                                  accessibilityRole="radio"
                                  accessibilityLabel={reason}
                                  accessibilityState={{ selected: declineReasonChoiceById[c.id] === reason }}
                                >
                                  <Ionicons
                                    name={declineReasonChoiceById[c.id] === reason ? "radio-button-on" : "radio-button-off"}
                                    size={16}
                                    color={declineReasonChoiceById[c.id] === reason ? "#076B51" : "#8AA194"}
                                  />
                                  <Text style={styles.declineReasonText}>{reason}</Text>
                                </TouchableOpacity>
                              ))}
                              <TextInput
                                style={[styles.input, styles.inputMultiline]}
                                placeholder="Add a note (optional)"
                                placeholderTextColor="#8AA194"
                                value={declineReasonById[c.id] ?? ""}
                                onChangeText={(text) => setDeclineReasonById((prev) => ({ ...prev, [c.id]: text }))}
                                multiline
                                accessibilityLabel="Additional note for declining"
                              />
                              <Text style={styles.hint}>The organiser will be notified and will need to choose a different supplier.</Text>
                              <TouchableOpacity
                                onPress={() => {
                                  Alert.alert("Decline this campaign?", "The organiser will be notified and will need to pick a different supplier. This can't be undone.", [
                                    { text: "Keep reviewing", style: "cancel" },
                                    { text: "Decline", style: "destructive", onPress: () => void handleDeclineCampaign(c.id) },
                                  ]);
                                }}
                                disabled={declining === c.id || !declineReasonChoiceById[c.id]}
                                activeOpacity={0.88}
                                style={[styles.declineConfirmBtn, !declineReasonChoiceById[c.id] && { opacity: 0.5 }]}
                                accessibilityRole="button"
                                accessibilityLabel="Confirm decline"
                                accessibilityState={{ busy: declining === c.id, disabled: declining === c.id || !declineReasonChoiceById[c.id] }}
                              >
                                {declining === c.id ? <ActivityIndicator size="small" color="#D6552F" /> : <Text style={styles.declineBtnText}>Confirm decline</Text>}
                              </TouchableOpacity>
                            </View>
                          ) : null}
                        </>
                      ) : c.supplierDeclinedAt ? (
                        <View style={styles.declinedRow}>
                          <Ionicons name="close-circle-outline" size={14} color="#6A7B72" />
                          <Text style={styles.declinedText}>You declined this campaign{c.supplierDeclineReason ? `: ${c.supplierDeclineReason}` : ""}</Text>
                        </View>
                      ) : c.supplierCommitted ? (
                        <FloatingCard style={styles.acceptedCard}>
                          <View style={styles.committedRow}>
                            <Ionicons name="checkmark-circle" size={14} color="#076B51" />
                            <Text style={styles.committedText}>Campaign accepted — you are confirmed as the supplier</Text>
                          </View>
                          {c.organiser?.user?.name ? <Text style={styles.acceptedMeta}>Organised by {c.organiser.user.name}</Text> : null}
                          {c.supplierCommittedAt ? <Text style={styles.acceptedMeta}>Terms accepted {formatDeadline(c.supplierCommittedAt)}</Text> : null}
                          <Text style={styles.acceptedMeta}>
                            Next milestone: {["DRAFT", "CHANGES_REQUIRED", "UNDER_REVIEW", "APPROVED"].includes(c.status)
                              ? "Eki review"
                              : ["LIVE", "PAUSED", "RESCUE_WINDOW"].includes(c.status)
                                ? `Campaign closes ${formatDeadline(c.deadline)}`
                                : CAMPAIGN_STATUS_LABELS[c.status]}
                          </Text>
                        </FloatingCard>
                      ) : null}

                      {/* Phase 5 (organiser<->supplier negotiation) — separate from the
                          binary accept/decline above: propose a change to price/slots/
                          ready-by date instead of (or after) accepting as-is. */}
                      {SUPPLIER_RESPONSE_STATUSES.includes(c.status) ? (
                        <TouchableOpacity
                          onPress={() => router.push({ pathname: "/(supplier)/community-buy-supplier-proposal", params: { id: c.id } } as any)}
                          activeOpacity={0.85}
                          style={styles.proposeBtn}
                          accessibilityRole="button"
                          accessibilityLabel="Propose changes"
                        >
                          <Ionicons name="swap-horizontal-outline" size={14} color="#076B51" />
                          <Text style={styles.proposeBtnText}>Propose changes</Text>
                        </TouchableOpacity>
                      ) : null}

                      {["FULFILLING", "SUCCEEDED", "COMPLETED"].includes(c.status) ? (
                        <TouchableOpacity
                          onPress={() => router.push({ pathname: "/(supplier)/community-buy-supplier-fulfilment", params: { id: c.id } } as any)}
                          activeOpacity={0.88}
                          style={styles.acceptBtn}
                          accessibilityRole="button"
                          accessibilityLabel="Manage fulfilment"
                        >
                          <Text style={styles.acceptBtnText}>Manage fulfilment</Text>
                        </TouchableOpacity>
                      ) : null}

                      {canPostUpdate ? (
                        <View style={{ marginTop: 4 }}>
                          <TouchableOpacity
                            onPress={() => setShowUpdateFormId(showUpdateFormId === c.id ? null : c.id)}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            accessibilityLabel={showUpdateFormId === c.id ? "Cancel" : "Post an update to participants"}
                            accessibilityState={{ expanded: showUpdateFormId === c.id }}
                          >
                            <Text style={styles.linkText}>{showUpdateFormId === c.id ? "Cancel" : "Post an update to participants"}</Text>
                          </TouchableOpacity>
                          {showUpdateFormId === c.id ? (
                            <View style={styles.inlineForm}>
                              <TextInput
                                style={styles.input}
                                placeholder="e.g. Dispatching Thursday"
                                placeholderTextColor="#8AA194"
                                value={updateTitleById[c.id] ?? ""}
                                onChangeText={(text) => setUpdateTitleById((prev) => ({ ...prev, [c.id]: text }))}
                                maxLength={140}
                                accessibilityLabel="Update title"
                              />
                              <TextInput
                                style={[styles.input, styles.inputMultiline]}
                                placeholder="What do participants need to know?"
                                placeholderTextColor="#8AA194"
                                value={updateMessageById[c.id] ?? ""}
                                onChangeText={(text) => setUpdateMessageById((prev) => ({ ...prev, [c.id]: text }))}
                                multiline
                                maxLength={2000}
                                accessibilityLabel="Update message"
                              />
                              <Text style={styles.hint}>Every participant is notified.</Text>
                              <TouchableOpacity
                                onPress={() => void handlePostUpdate(c.id)}
                                disabled={postingUpdate === c.id}
                                activeOpacity={0.88}
                                style={styles.acceptBtn}
                                accessibilityRole="button"
                                accessibilityLabel="Post update"
                                accessibilityState={{ busy: postingUpdate === c.id, disabled: postingUpdate === c.id }}
                              >
                                {postingUpdate === c.id ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.acceptBtnText}>Post update</Text>}
                              </TouchableOpacity>
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </FloatingCard>
                  );
                })}
              </View>
            )}
          </View>
        );
      }
      default:
        return renderInfoState({ icon: "help-circle-outline", tone: "info", title: SUPPLIER_ACCOUNT_STATE_LABELS[state], body: "" });
    }
  };

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title="Supplier Centre" subtitle="Wholesale Supply" onBack={() => goBackOrReplace(router, "/launcher" as any)} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        {loading ? <LoadingBlock /> : error ? (
          <View style={premiumStyles.block}><ErrorState message={error} onRetry={() => void load()} /></View>
        ) : renderByState()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  formSection: { fontSize: 14, fontFamily: "Manrope-ExtraBold", color: "#12221A" },
  methodRow: { flexDirection: "row", gap: 10 },
  methodChip: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minHeight: 46, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#F4F6F5", borderWidth: 1, borderColor: "transparent" },
  methodChipActive: { borderColor: "#076B51", backgroundColor: "#EFF7F3" },
  methodText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  stepText: { flex: 1, fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#151E1B", lineHeight: 19 },
  sectionRow: { gap: 8, paddingRight: 8 },
  sectionTab: { minHeight: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: "#EEF2F0", alignItems: "center", justifyContent: "center" },
  sectionTabActive: { backgroundColor: "#076B51" },
  sectionTabText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#3E5148" },
  sectionTabTextActive: { color: "#FFFFFF" },
  tileRow: { flexDirection: "row", gap: 8 },
  tile: { alignItems: "center", gap: 4, paddingHorizontal: 6 },
  tileCount: { fontSize: 22, fontFamily: "Manrope-ExtraBold", color: "#076B51" },
  tileLabel: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#5B6D64", textAlign: "center" },
  wholesaleCard: { gap: 6, backgroundColor: "#F4F6F5" },
  wholesaleTitle: { fontSize: 12, fontFamily: "Manrope-ExtraBold", color: "#12221A" },
  previewRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  fieldHint: { flex: 1, fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  previewValue: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
  wholesaleTotalRow: { borderTopWidth: 1, borderTopColor: "#E1E7E3", paddingTop: 6, marginTop: 2 },
  wholesaleTotalLabel: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#151E1B" },
  wholesaleTotalValue: { fontSize: 13, fontFamily: "Manrope-ExtraBold", color: "#076B51" },
  introCard: { alignItems: "center", gap: 8 },
  introTitle: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#151E1B" },
  introBody: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#6A7B72", textAlign: "center", lineHeight: 19 },
  formLabel: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#4A5A52" },
  bannerCard: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  bannerText: { flex: 1, fontSize: 12, fontFamily: "Outfit-Regular", color: "#4A5A52", lineHeight: 17 },
  errorText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#D6552F", textAlign: "center" },
  emptyText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#6A7B72", textAlign: "center", paddingVertical: 8 },
  section: { fontSize: 15, fontFamily: "Manrope-ExtraBold", color: "#12221A" },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontFamily: "Manrope-Bold", color: "#151E1B" },
  cardDescription: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#4A5A52", lineHeight: 17 },
  cardMeta: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  acceptBtn: { minHeight: 42, borderRadius: 12, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", marginTop: 6 },
  acceptBtnText: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  proposeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 38, borderRadius: 12, borderWidth: 1, borderColor: "#076B51", marginTop: 6 },
  proposeBtnText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  committedRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  acceptedCard: { gap: 4, marginTop: 6 },
  acceptedMeta: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  committedText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#076B51" },
  declinedRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 4 },
  declinedText: { flex: 1, fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72", lineHeight: 16 },
  decisionRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  declineBtn: { flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: "#D6552F", alignItems: "center", justifyContent: "center" },
  declineBtnText: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#D6552F" },
  declineConfirmBtn: { minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: "#D6552F", alignItems: "center", justifyContent: "center" },
  inlineForm: { gap: 8, marginTop: 6, borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 10 },
  input: { backgroundColor: "#F4F6F5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, fontFamily: "Outfit-Regular", color: "#151E1B" },
  inputMultiline: { minHeight: 60, textAlignVertical: "top" },
  hint: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#8AA194" },
  declineReasonRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  declineReasonText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#151E1B" },
  linkText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#076B51" },
});
