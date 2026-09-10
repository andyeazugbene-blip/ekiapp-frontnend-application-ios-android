import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import { presentSetupIntent } from "../../services/stripePayment";
import { countryCodeForName, countryDisplayName } from "../../utils/countries";
import { regularDeliveriesService, type BuyerPaymentMethod } from "../../services/regularDeliveriesService";
import {
  ErrorState,
  FloatingCard,
  LoadingBlock,
  PremiumHeader,
  PrimaryButton,
  RangeProgressBar,
  StatusPill,
  premiumStyles,
} from "../../components/shared/PremiumBlocks";
import { DatePickerField } from "../../components/shared/DatePickerField";
import {
  communityBuyService,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_TONE,
  type Campaign,
  type CampaignFulfilment,
  type CampaignParticipant,
  type CampaignUpdate,
  type MarketConfig,
  type RefundProgress,
  type SupplierProfile,
} from "../../services/communityBuyService";

// Mirrors the backend's postCampaignUpdate() gate (community-campaigns.service.ts) —
// an update only makes sense once a campaign has actually gone live.
const UPDATE_POSTABLE_STATUSES = ["LIVE", "PAUSED", "CLOSING", "RESCUE_WINDOW", "SUCCEEDED", "FAILED", "REFUNDING", "FULFILLING", "COMPLETED", "FINANCIALLY_CLOSED"];

const FULFILMENT_STEP_LABEL: Record<CampaignFulfilment["status"], string> = {
  AWAITING_INVENTORY_CONFIRMATION: "Waiting for the supplier to confirm inventory",
  INVENTORY_CONFIRMED: "Supplier is preparing a fulfilment plan",
  PACKING: "Supplier is packing your order",
  READY_FOR_DISPATCH_OR_COLLECTION: "Ready for dispatch/collection",
  DISPATCHED: "Dispatched by the supplier",
  COLLECTED: "Ready for collection from the supplier",
  COMPLETED: "Completed",
};

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function CommunityBuyOrganiserCampaignScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [suppliers, setSuppliers] = useState<(SupplierProfile & { vendor?: { storeName: string } })[]>([]);
  const [supplierId, setSupplierId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [minimumShares, setMinimumShares] = useState("");
  const [goalShares, setGoalShares] = useState("");
  const [maximumShares, setMaximumShares] = useState("");
  const [pricePerShare, setPricePerShare] = useState("");
  const [deadline, setDeadline] = useState("");

  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState<"top-up" | "extension" | "end" | null>(null);
  const [topUpQuantity, setTopUpQuantity] = useState("1");
  const [paymentMethods, setPaymentMethods] = useState<BuyerPaymentMethod[]>([]);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [addingCard, setAddingCard] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [showExtensionForm, setShowExtensionForm] = useState(false);
  const [extensionDeadline, setExtensionDeadline] = useState("");
  const [extensionReason, setExtensionReason] = useState("");
  const [supplierReconfirmed, setSupplierReconfirmed] = useState(false);
  const [priceUnchangedConfirmed, setPriceUnchangedConfirmed] = useState(false);
  const [participants, setParticipants] = useState<CampaignParticipant[]>([]);
  const [refundProgress, setRefundProgress] = useState<RefundProgress | null>(null);
  const [fulfilment, setFulfilment] = useState<CampaignFulfilment | null>(null);
  const [confirmingCompletion, setConfirmingCompletion] = useState(false);
  const [updates, setUpdates] = useState<CampaignUpdate[]>([]);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [updateTitleInput, setUpdateTitleInput] = useState("");
  const [updateMessageInput, setUpdateMessageInput] = useState("");
  const [postingUpdate, setPostingUpdate] = useState(false);
  const [marketConfig, setMarketConfig] = useState<MarketConfig | null>(null);
  const { selectedCurrency } = useCurrencyStore();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (id) {
        const existing = await communityBuyService.getCampaign(id);
        setCampaign(existing);
        setCountry(existing.country);
        setCurrency(existing.currency);
        setSupplierId(existing.supplierId);
        communityBuyService.getMarketConfig(existing.country).then(setMarketConfig).catch(() => undefined);
        setTitle(existing.title);
        setDescription(existing.description ?? "");
        setMinimumShares(String(existing.minimumShares ?? ""));
        setGoalShares(String(existing.goalShares ?? ""));
        setMaximumShares(String(existing.maximumShares ?? ""));
        setPricePerShare(existing.pricePerShareMinor ? String(existing.pricePerShareMinor / 100) : "");
        setDeadline(existing.deadline.slice(0, 10));
        setParticipants(await communityBuyService.listCampaignParticipants(id).catch(() => []));
        if (existing.status === "RESCUE_WINDOW") {
          const methods = await regularDeliveriesService.listPaymentMethods().catch(() => [] as BuyerPaymentMethod[]);
          setPaymentMethods(methods);
          setPaymentMethodId((prev) => prev ?? methods.find((m) => m.isDefault)?.id ?? methods[0]?.id ?? null);
        }
        if (["FAILED", "CANCELLED", "REFUNDING"].includes(existing.status)) {
          setRefundProgress(await communityBuyService.getRefundProgress(id).catch(() => null));
        }
        if (["FULFILLING", "SUCCEEDED", "COMPLETED"].includes(existing.status)) {
          setFulfilment(await communityBuyService.getOrganiserFulfilment(id).catch(() => null));
        }
        if (UPDATE_POSTABLE_STATUSES.includes(existing.status)) {
          setUpdates(await communityBuyService.getCampaignUpdates(id).catch(() => []));
        }
        // Necessary companion to supplier decline — without a way to pick a
        // different supplier, a decline would be a dead end for the organiser.
        if (existing.supplierDeclinedAt) {
          setSuppliers(await communityBuyService.listVerifiedSuppliers(existing.country).catch(() => []));
        }
      } else {
        const profile = await communityBuyService.getMyOrganiserProfile();
        if (!profile?.isVerified) throw new Error("A verified organiser profile is required to create a campaign.");
        setCountry(profile.country);
        const markets = await communityBuyService.listMarketConfigs().catch(() => [] as MarketConfig[]);
        const market = markets.find((m) => (countryCodeForName(m.countryCode) ?? m.countryCode) === (countryCodeForName(profile.country) ?? profile.country));
        setCurrency(market?.currency ?? "GBP");
        setMarketConfig(market ?? null);
        const supplierList = await communityBuyService.listVerifiedSuppliers(profile.country);
        setSuppliers(supplierList);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this campaign.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSave = async () => {
    if (!title.trim()) return Alert.alert("Title required", "Give this campaign a name.");

    const isLiveLike = campaign ? ["LIVE", "PAUSED", "RESCUE_WINDOW"].includes(campaign.status) : false;

    // While live, only title/description are editable — financial terms
    // are locked once contributions begin, so those fields aren't
    // validated or sent at all in that case.
    if (isLiveLike) {
      setSaving(true);
      try {
        setCampaign(await communityBuyService.updateCampaign(campaign!.id, {
          title: title.trim(),
          description: description.trim() || undefined,
        }));
        Alert.alert("Saved", "Campaign updated.");
      } catch (err) {
        Alert.alert("Couldn't save", err instanceof Error ? err.message : "Please try again.");
      } finally {
        setSaving(false);
      }
      return;
    }

    const minVal = Math.round(Number(minimumShares));
    const goalVal = Math.round(Number(goalShares));
    const maxVal = Math.round(Number(maximumShares));
    const priceVal = Number(pricePerShare);
    if (!Number.isFinite(minVal) || minVal < 1) return Alert.alert("Minimum required", "Enter the minimum shares required to proceed.");
    if (!Number.isFinite(goalVal) || goalVal < minVal) return Alert.alert("Goal required", "The campaign goal must be at least the minimum shares.");
    if (!Number.isFinite(maxVal) || maxVal < goalVal) return Alert.alert("Maximum required", "Maximum capacity must be at least the campaign goal.");
    if (!Number.isFinite(priceVal) || priceVal <= 0) return Alert.alert("Price required", "Enter a valid price per share.");
    const deadlineDate = new Date(deadline);
    if (Number.isNaN(deadlineDate.getTime()) || deadlineDate <= new Date()) return Alert.alert("Deadline required", "Enter a valid future date (YYYY-MM-DD).");

    setSaving(true);
    try {
      if (isEdit && campaign) {
        const updated = await communityBuyService.updateCampaign(campaign.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          minimumShares: minVal,
          goalShares: goalVal,
          maximumShares: maxVal,
          pricePerShareMinor: Math.round(priceVal * 100),
          deadline: deadlineDate.toISOString(),
        });
        setCampaign(updated);
        Alert.alert("Saved", "Campaign updated.");
      } else {
        if (!supplierId) return Alert.alert("Supplier required", "Choose a supplier for this campaign.");
        const created = await communityBuyService.createCampaign({
          supplierId,
          title: title.trim(),
          description: description.trim() || undefined,
          country,
          currency,
          minimumShares: minVal,
          goalShares: goalVal,
          maximumShares: maxVal,
          pricePerShareMinor: Math.round(priceVal * 100),
          deadline: deadlineDate.toISOString(),
        });
        router.replace({ pathname: "/(buyer)/community-buy-organiser-campaign", params: { id: created.id } } as any);
      }
    } catch (err) {
      Alert.alert("Couldn't save", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleReassignSupplier = async (newSupplierId: string) => {
    if (!campaign || reassigning) return;
    setReassigning(true);
    try {
      const updated = await communityBuyService.reassignSupplier(campaign.id, newSupplierId);
      setCampaign(updated);
      setSupplierId(updated.supplierId);
    } catch (err) {
      Alert.alert("Couldn't reassign supplier", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setReassigning(false);
    }
  };

  const handleShare = async () => {
    if (!campaign) return;
    try {
      await Share.share({
        message: `Help "${campaign.title}" reach its goal on Eki Community Buy — ${campaign.confirmedShares} of ${campaign.maximumShares} slots filled so far. Open the Eki app to take part.`,
      });
    } catch {
      // User cancelled the native share sheet — nothing to do.
    }
  };

  const handleConfirmFulfilmentCompletion = async () => {
    if (!campaign) return;
    setConfirmingCompletion(true);
    try {
      setFulfilment(await communityBuyService.organiserConfirmFulfilmentCompletion(campaign.id));
      Alert.alert("Confirmed", "Thanks for confirming — this campaign is now complete.");
    } catch (err) {
      Alert.alert("Couldn't confirm this", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setConfirmingCompletion(false);
    }
  };

  const handleSubmit = async () => {
    if (!campaign) return;
    setSubmitting(true);
    try {
      setCampaign(await communityBuyService.submitCampaign(campaign.id));
      Alert.alert("Submitted", "Your campaign was sent for admin review.");
    } catch (err) {
      Alert.alert("Couldn't submit", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (!campaign) return;
    setPublishing(true);
    try {
      setCampaign(await communityBuyService.publishCampaign(campaign.id));
      Alert.alert("Published", "Your campaign is now live.");
    } catch (err) {
      Alert.alert("Couldn't publish", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setPublishing(false);
    }
  };

  // Rescue-window actions — doc §8. There is no "fulfil anyway below
  // minimum" action; only these four ways out of RESCUE_WINDOW.

  const handleAddCard = async () => {
    setAddingCard(true);
    try {
      const { clientSecret } = await regularDeliveriesService.createSetupIntent();
      const result = await presentSetupIntent({ clientSecret });
      if (result.status === "succeeded") {
        const setupIntentId = clientSecret.split("_secret_")[0];
        await regularDeliveriesService.confirmSetupIntent(setupIntentId);
        const methods = await regularDeliveriesService.listPaymentMethods();
        setPaymentMethods(methods);
        setPaymentMethodId(methods.find((m) => m.isDefault)?.id ?? methods[0]?.id ?? null);
      } else if (result.status !== "cancelled") {
        Alert.alert("Could not save card", result.message ?? "Please try again.");
      }
    } catch (err) {
      Alert.alert("Could not save card", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setAddingCard(false);
    }
  };

  /**
   * PLEDGE_THEN_CHARGE (client mandate 2026-09): the organiser's top-up
   * pledges the shortfall — no charge happens now. It is only captured if
   * the rescued campaign goes on to reach its minimum/goal.
   */
  const handleTopUp = async () => {
    if (!campaign || decisionBusy) return;
    const qty = Math.round(Number(topUpQuantity));
    if (!Number.isFinite(qty) || qty <= 0) return Alert.alert("Quantity required", "Enter how many shares you want to pledge.");
    if (!paymentMethodId) return Alert.alert("Payment method required", "Add a card to pledge this top-up.");
    setDecisionBusy("top-up");
    try {
      await communityBuyService.createOrganiserTopUp(campaign.id, qty, paymentMethodId);
      setCampaign(await communityBuyService.getCampaign(campaign.id));
      Alert.alert("Pledge recorded", "Your top-up is pledged. Your card will only be charged if this campaign goes on to succeed.");
    } catch (err) {
      Alert.alert("Couldn't record the top-up", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setDecisionBusy(null);
    }
  };

  const handleSubmitExtension = async () => {
    if (!campaign) return;
    const deadlineDate = new Date(extensionDeadline);
    if (Number.isNaN(deadlineDate.getTime()) || deadlineDate <= new Date()) return Alert.alert("Deadline required", "Enter a valid future date (YYYY-MM-DD).");
    if (!extensionReason.trim()) return Alert.alert("Reason required", "Explain why this campaign should remain open.");
    setDecisionBusy("extension");
    try {
      await communityBuyService.requestExtension(campaign.id, {
        requestedDeadline: deadlineDate.toISOString(),
        reason: extensionReason.trim(),
        supplierReconfirmed,
        priceUnchangedConfirmed,
        participantTermsUnchanged: true,
      });
      setShowExtensionForm(false);
      Alert.alert("Extension requested", "Eki must approve this before your deadline changes. We'll notify you and your participants.");
    } catch (err) {
      Alert.alert("Couldn't submit your request", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setDecisionBusy(null);
    }
  };

  const handleEndRescue = () => {
    if (!campaign) return;
    Alert.alert(
      "End campaign and begin refunds?",
      "Participants who contributed will be refunded. This can't be undone.",
      [
        { text: "Keep deciding", style: "cancel" },
        {
          text: "End campaign",
          style: "destructive",
          onPress: async () => {
            setDecisionBusy("end");
            try {
              setCampaign(await communityBuyService.endCampaignRescue(campaign.id));
            } catch (err) {
              Alert.alert("Couldn't end this campaign", err instanceof Error ? err.message : "Please try again.");
            } finally {
              setDecisionBusy(null);
            }
          },
        },
      ],
    );
  };

  const handlePostUpdate = async () => {
    if (!campaign) return;
    if (!updateTitleInput.trim() || !updateMessageInput.trim()) {
      return Alert.alert("Title and message required", "Give participants both a title and a message.");
    }
    setPostingUpdate(true);
    try {
      const posted = await communityBuyService.postCampaignUpdate(campaign.id, updateTitleInput.trim(), updateMessageInput.trim());
      setUpdates((prev) => [posted, ...prev]);
      setUpdateTitleInput("");
      setUpdateMessageInput("");
      setShowUpdateForm(false);
      Alert.alert("Update posted", "Every participant has been notified.");
    } catch (err) {
      Alert.alert("Couldn't post this update", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setPostingUpdate(false);
    }
  };

  const isDraftLike = campaign ? ["DRAFT", "CHANGES_REQUIRED"].includes(campaign.status) : true;
  const isLiveLike = campaign ? ["LIVE", "PAUSED", "RESCUE_WINDOW"].includes(campaign.status) : false;
  // Financial terms (min/goal/max/price/deadline) can only change in draft.
  // Title/description stay editable while live too — "Edit Live Campaign"
  // is about correcting copy, never about changing terms participants
  // already paid under.
  const financialFieldsLocked = !isDraftLike;
  const contentEditable = isDraftLike || isLiveLike;
  const isLocked = !contentEditable;

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader
        title={isEdit ? "Campaign" : "New campaign"}
        onBack={() => goBackOrReplace(router, "/(buyer)/community-buy-organiser" as any)}
        right={
          isEdit && campaign?.status === "LIVE" ? (
            <TouchableOpacity
              onPress={() => void handleShare()}
              activeOpacity={0.85}
              style={styles.headerIconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Share this campaign"
            >
              <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          ) : undefined
        }
      />

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <View style={premiumStyles.block}><ErrorState message={error} onRetry={() => void load()} /></View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
          <View style={[premiumStyles.block, { gap: 14 }]}>
            {campaign?.status === "CHANGES_REQUIRED" && campaign.reviewNotes ? (
              <FloatingCard style={styles.noticeCard}>
                <Ionicons name="alert-circle-outline" size={18} color="#B48A00" />
                <Text style={styles.noticeText}>{campaign.reviewNotes}</Text>
              </FloatingCard>
            ) : null}
            {campaign ? <StatusPill label={CAMPAIGN_STATUS_LABELS[campaign.status]} tone={CAMPAIGN_STATUS_TONE[campaign.status]} /> : null}

            {campaign?.status === "RESCUE_WINDOW" ? (
              <FloatingCard style={{ gap: 10 }}>
                <Text style={styles.outcomeTitle}>This campaign needs {Math.max(0, campaign.minimumShares - campaign.confirmedShares)} more participant{Math.max(0, campaign.minimumShares - campaign.confirmedShares) === 1 ? "" : "s"}</Text>
                <RangeProgressBar value={campaign.confirmedShares} min={campaign.minimumShares} goal={campaign.goalShares} max={campaign.maximumShares} />
                <View style={styles.outcomeRow}><Text style={styles.outcomeLabel}>Status</Text><Text style={styles.outcomeValue}>No supplier order has been created</Text></View>
                <View style={styles.outcomeRow}><Text style={styles.outcomeLabel}>Time remaining</Text><Text style={styles.outcomeValue}>{formatDateTime(campaign.rescueEndsAt)}</Text></View>
                <Text style={styles.outcomeHint}>You have until then to complete one of these actions. Do not collect payment from participants outside Eki.</Text>

                <Text style={styles.rescueSectionLabel}>Pledge the remaining share(s)</Text>
                <Text style={styles.outcomeHint}>No charge now — your card is only charged if this campaign goes on to succeed.</Text>
                <View style={{ gap: 8 }}>
                  {paymentMethods.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      onPress={() => setPaymentMethodId(m.id)}
                      activeOpacity={0.85}
                      accessibilityRole="radio"
                      accessibilityLabel={`${(m.brand ?? "Card").toUpperCase()} ending ${m.last4}`}
                      accessibilityState={{ selected: paymentMethodId === m.id }}
                    >
                      <FloatingCard style={[styles.optionRow, paymentMethodId === m.id && styles.optionRowActive]}>
                        <Ionicons name={paymentMethodId === m.id ? "radio-button-on" : "radio-button-off"} size={18} color={paymentMethodId === m.id ? "#076B51" : "#C7D2CB"} />
                        <Text style={styles.optionText}>{(m.brand ?? "Card").toUpperCase()} •••• {m.last4}</Text>
                      </FloatingCard>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    onPress={() => void handleAddCard()}
                    disabled={addingCard}
                    activeOpacity={0.85}
                    style={styles.addRow}
                    accessibilityRole="button"
                    accessibilityLabel="Add a card"
                    accessibilityState={{ busy: addingCard, disabled: addingCard }}
                  >
                    {addingCard ? <ActivityIndicator size="small" color="#076B51" /> : <Ionicons name="card-outline" size={18} color="#076B51" />}
                    <Text style={styles.addRowText}>{addingCard ? "Saving card..." : "Add a card"}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.quantityRow}>
                  <TextInput
                    style={styles.quantityInput}
                    keyboardType="number-pad"
                    value={topUpQuantity}
                    onChangeText={setTopUpQuantity}
                    placeholder="1"
                    placeholderTextColor="#8AA194"
                    accessibilityLabel="Number of shares to pledge"
                  />
                  <TouchableOpacity
                    onPress={handleTopUp}
                    disabled={decisionBusy !== null}
                    activeOpacity={0.88}
                    style={styles.fulfilBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Pledge ${formatDisplayMoney((Math.round(Number(topUpQuantity)) || 0) * campaign.pricePerShareMinor / 100, campaign.currency, selectedCurrency)}`}
                    accessibilityState={{ busy: decisionBusy === "top-up", disabled: decisionBusy !== null }}
                  >
                    {decisionBusy === "top-up" ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.fulfilBtnText}>Pledge {formatDisplayMoney((Math.round(Number(topUpQuantity)) || 0) * campaign.pricePerShareMinor / 100, campaign.currency, selectedCurrency)}</Text>}
                  </TouchableOpacity>
                </View>

                <View style={styles.decisionRow}>
                  <TouchableOpacity
                    onPress={() => setShowExtensionForm((v) => !v)}
                    disabled={decisionBusy !== null || campaign.extensionCount >= 1}
                    activeOpacity={0.88}
                    style={[styles.secondaryBtn, { flex: 1, marginTop: 0 }]}
                    accessibilityRole="button"
                    accessibilityLabel={campaign.extensionCount >= 1 ? "Extension already used" : "Request extension"}
                    accessibilityState={{ disabled: decisionBusy !== null || campaign.extensionCount >= 1, expanded: showExtensionForm }}
                  >
                    <Text style={styles.secondaryBtnText}>{campaign.extensionCount >= 1 ? "Extension already used" : "Request extension"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleEndRescue}
                    disabled={decisionBusy !== null}
                    activeOpacity={0.88}
                    style={styles.cancelBtn}
                    accessibilityRole="button"
                    accessibilityLabel="End campaign"
                    accessibilityState={{ busy: decisionBusy === "end", disabled: decisionBusy !== null }}
                  >
                    {decisionBusy === "end" ? <ActivityIndicator size="small" color="#D6552F" /> : <Text style={styles.cancelBtnText}>End Campaign</Text>}
                  </TouchableOpacity>
                </View>

                {showExtensionForm ? (
                  <View style={styles.extensionForm}>
                    <DatePickerField
                      label="Requested new deadline"
                      value={extensionDeadline}
                      onChange={setExtensionDeadline}
                      minimumDate={new Date(Date.now() + 24 * 60 * 60 * 1000)}
                    />
                    <Text style={styles.label}>Reason for extension</Text>
                    <TextInput
                      style={[styles.input, styles.inputMultiline]}
                      placeholder="Explain why this campaign should remain open"
                      placeholderTextColor="#8AA194"
                      value={extensionReason}
                      onChangeText={setExtensionReason}
                      multiline
                      accessibilityLabel="Reason for extension"
                    />
                    <TouchableOpacity
                      onPress={() => setSupplierReconfirmed((v) => !v)}
                      activeOpacity={0.85}
                      style={styles.checkboxRow}
                      accessibilityRole="checkbox"
                      accessibilityLabel="The supplier confirms the product, price and inventory remain available"
                      accessibilityState={{ checked: supplierReconfirmed }}
                    >
                      <Ionicons name={supplierReconfirmed ? "checkbox" : "square-outline"} size={20} color="#076B51" />
                      <Text style={styles.checkboxText}>The supplier confirms the product, price and inventory remain available.</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setPriceUnchangedConfirmed((v) => !v)}
                      activeOpacity={0.85}
                      style={styles.checkboxRow}
                      accessibilityRole="checkbox"
                      accessibilityLabel="The participant price is unchanged"
                      accessibilityState={{ checked: priceUnchangedConfirmed }}
                    >
                      <Ionicons name={priceUnchangedConfirmed ? "checkbox" : "square-outline"} size={20} color="#076B51" />
                      <Text style={styles.checkboxText}>The participant price is unchanged.</Text>
                    </TouchableOpacity>
                    <Text style={styles.outcomeHint}>An extension is not automatic. Eki must approve it and notify every participant.</Text>
                    <TouchableOpacity
                      onPress={handleSubmitExtension}
                      disabled={decisionBusy !== null}
                      activeOpacity={0.88}
                      style={styles.primaryBtnInline}
                      accessibilityRole="button"
                      accessibilityLabel="Submit extension request"
                      accessibilityState={{ busy: decisionBusy === "extension", disabled: decisionBusy !== null }}
                    >
                      {decisionBusy === "extension" ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Submit extension request</Text>}
                    </TouchableOpacity>
                  </View>
                ) : null}
              </FloatingCard>
            ) : campaign?.status === "FULFILLING" || campaign?.status === "SUCCEEDED" || campaign?.status === "COMPLETED" ? (
              <FloatingCard style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#076B51" />
                  <Text style={styles.outcomeHint}>
                    {campaign.fundingOutcome === "GOAL_REACHED" ? "Your campaign goal was reached." : "The minimum requirement was reached — this campaign will proceed."} Confirmed quantity: {campaign.confirmedShares}.
                  </Text>
                </View>
                {fulfilment ? (
                  <>
                    <View style={styles.outcomeRow}><Text style={styles.outcomeLabel}>Fulfilment status</Text><Text style={styles.outcomeValue}>{FULFILMENT_STEP_LABEL[fulfilment.status]}</Text></View>
                    {(fulfilment.status === "DISPATCHED" || fulfilment.status === "COLLECTED") ? (
                      <TouchableOpacity
                        onPress={() => void handleConfirmFulfilmentCompletion()}
                        disabled={confirmingCompletion}
                        activeOpacity={0.88}
                        style={[styles.secondaryBtn, { marginTop: 4 }]}
                        accessibilityRole="button"
                        accessibilityLabel="Confirm receipt, mark as completed"
                        accessibilityState={{ busy: confirmingCompletion, disabled: confirmingCompletion }}
                      >
                        {confirmingCompletion ? <ActivityIndicator size="small" color="#076B51" /> : <Text style={styles.secondaryBtnText}>Confirm receipt — mark as completed</Text>}
                      </TouchableOpacity>
                    ) : null}
                  </>
                ) : null}
              </FloatingCard>
            ) : campaign?.status === "FAILED" ? (
              <FloatingCard style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                <Ionicons name="time-outline" size={18} color="#B48A00" />
                <Text style={styles.outcomeHint}>This campaign did not reach its minimum requirement. No supplier order will be created — no participant was ever charged, so there is nothing to refund. Any saved pledges have been cancelled.</Text>
              </FloatingCard>
            ) : campaign?.status === "CANCELLED" ? (
              <FloatingCard style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                <Ionicons name="return-down-back-outline" size={18} color="#6A7B72" />
                <Text style={styles.outcomeHint}>This campaign was ended. Contributions are being refunded.</Text>
              </FloatingCard>
            ) : campaign?.status === "LIVE" ? (
              <>
                {/* CBO-13 fix: a healthy LIVE campaign previously had no
                    progress visualization at all — RangeProgressBar only
                    ever appeared once a campaign was already in
                    RESCUE_WINDOW crisis, exactly backwards from useful. */}
                <FloatingCard style={{ gap: 10 }}>
                  <Text style={styles.outcomeTitle}>Live progress</Text>
                  <RangeProgressBar value={campaign.confirmedShares} min={campaign.minimumShares} goal={campaign.goalShares} max={campaign.maximumShares} />
                  <View style={styles.outcomeRow}><Text style={styles.outcomeLabel}>Confirmed shares</Text><Text style={styles.outcomeValue}>{campaign.confirmedShares} of {campaign.goalShares} goal</Text></View>
                </FloatingCard>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: "/(buyer)/community-buy-campaign", params: { id: campaign.id } } as any)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Pledge shares yourself through the normal campaign page"
                >
                  <FloatingCard style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                    <Ionicons name="add-circle-outline" size={18} color="#076B51" />
                    <Text style={styles.outcomeHint}>Want to help this along? You can pledge shares yourself anytime through the normal campaign page — the same way any participant would.</Text>
                    <Ionicons name="chevron-forward" size={16} color="#C7D2CB" />
                  </FloatingCard>
                </TouchableOpacity>
              </>
            ) : null}

            {refundProgress && refundProgress.total > 0 ? (
              <FloatingCard style={{ gap: 6 }}>
                <Text style={styles.outcomeTitle}>Refund progress</Text>
                <View style={styles.outcomeRow}><Text style={styles.outcomeLabel}>Completed</Text><Text style={styles.outcomeValue}>{refundProgress.completed} of {refundProgress.total}</Text></View>
                {refundProgress.pending > 0 ? <View style={styles.outcomeRow}><Text style={styles.outcomeLabel}>In progress</Text><Text style={styles.outcomeValue}>{refundProgress.pending}</Text></View> : null}
                {refundProgress.failed > 0 ? <View style={styles.outcomeRow}><Text style={[styles.outcomeLabel, { color: "#D6552F" }]}>Needs attention</Text><Text style={[styles.outcomeValue, { color: "#D6552F" }]}>{refundProgress.failed}</Text></View> : null}
              </FloatingCard>
            ) : null}

            <FloatingCard style={{ gap: 12 }}>
              <View>
                <Text style={styles.label}>Title</Text>
                <TextInput style={styles.input} editable={!isLocked} placeholder="Campaign title" placeholderTextColor="#8AA194" value={title} onChangeText={setTitle} accessibilityLabel="Campaign title" />
              </View>

              <View>
                <Text style={styles.label}>Description (optional)</Text>
                <TextInput style={[styles.input, styles.inputMultiline]} editable={!isLocked} placeholder="What is this campaign for?" placeholderTextColor="#8AA194" value={description} onChangeText={setDescription} multiline accessibilityLabel="Description" />
              </View>

              <View style={styles.thresholdGroup}>
                <View style={styles.thresholdRow}>
                  <View style={[styles.thresholdDot, { backgroundColor: "#D6552F" }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Minimum shares required</Text>
                    <TextInput style={styles.input} editable={!financialFieldsLocked} placeholder="3" placeholderTextColor="#8AA194" keyboardType="number-pad" value={minimumShares} onChangeText={setMinimumShares} accessibilityLabel="Minimum shares required" />
                    <Text style={styles.fieldHint}>Below this, the campaign does not proceed.</Text>
                  </View>
                </View>
                <View style={styles.thresholdRow}>
                  <View style={[styles.thresholdDot, { backgroundColor: "#B48A00" }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Campaign goal</Text>
                    <TextInput style={styles.input} editable={!financialFieldsLocked} placeholder="6" placeholderTextColor="#8AA194" keyboardType="number-pad" value={goalShares} onChangeText={setGoalShares} accessibilityLabel="Campaign goal" />
                    <Text style={styles.fieldHint}>A milestone, not a requirement — the campaign proceeds at the minimum even if the goal isn't reached.</Text>
                  </View>
                </View>
                <View style={styles.thresholdRow}>
                  <View style={[styles.thresholdDot, { backgroundColor: "#076B51" }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Maximum capacity</Text>
                    <TextInput style={styles.input} editable={!financialFieldsLocked} placeholder="6" placeholderTextColor="#8AA194" keyboardType="number-pad" value={maximumShares} onChangeText={setMaximumShares} accessibilityLabel="Maximum capacity" />
                    <Text style={styles.fieldHint}>Contributions stop being accepted once this is reached. Never required for success.</Text>
                  </View>
                </View>
              </View>

              <FloatingCard style={styles.outcomeExplainerCard}>
                <Text style={styles.outcomeExplainerTitle}>What happens at the deadline</Text>
                <Text style={styles.outcomeExplainerText}>• Confirmed shares reach the goal → the campaign proceeds, goal reached.</Text>
                <Text style={styles.outcomeExplainerText}>• Confirmed shares reach the minimum but not the goal → the campaign still proceeds.</Text>
                <Text style={styles.outcomeExplainerText}>• Confirmed shares are below the minimum → a completion period opens (typically 48 hours) for you to close the gap by topping up yourself or inviting more people, or to request one admin-approved extension.</Text>
                <Text style={styles.outcomeExplainerText}>• If the completion period ends still below the minimum → the campaign fails. No participant was ever charged, so nothing needs refunding.</Text>
              </FloatingCard>

              <View>
                <Text style={styles.label}>Price per share ({currency})</Text>
                <TextInput style={styles.input} editable={!financialFieldsLocked} placeholder="0.00" placeholderTextColor="#8AA194" keyboardType="decimal-pad" value={pricePerShare} onChangeText={setPricePerShare} accessibilityLabel={`Price per share in ${currency}`} />
                <Text style={styles.fieldHint}>The price per share cannot change after the first confirmed contribution.</Text>
              </View>

              {marketConfig?.communityBuyFeeBps != null ? (
                <FloatingCard style={styles.feeCard}>
                  <Text style={styles.label}>Eki's processing fee</Text>
                  <Text style={styles.feeValue}>{(marketConfig.communityBuyFeeBps / 100).toFixed(2)}%</Text>
                  <Text style={styles.fieldHint}>
                    Taken from the supplier's payment when this campaign succeeds — never an extra charge to you or your participants.
                    {pricePerShare && Number(pricePerShare) > 0 && minimumShares ? ` At the minimum (${minimumShares} shares), the supplier would receive approximately ${formatDisplayMoney((Math.round(Number(pricePerShare) * 100) * (Math.round(Number(minimumShares)) || 0) * (10000 - marketConfig.communityBuyFeeBps)) / 10000 / 100, currency, selectedCurrency)} after Eki's fee.` : ""}
                  </Text>
                </FloatingCard>
              ) : (
                <FloatingCard style={styles.feeCard}>
                  <Text style={styles.fieldHint}>Eki's processing fee for this market hasn't been configured yet. It's taken from the supplier's payment on success — never an extra charge to you or your participants.</Text>
                </FloatingCard>
              )}

              <DatePickerField
                label="Deadline"
                value={deadline}
                onChange={setDeadline}
                disabled={financialFieldsLocked}
                minimumDate={new Date(Date.now() + 24 * 60 * 60 * 1000)}
                hint={isLiveLike ? "Financial terms are locked once a campaign is live. Only the title and description can be changed." : "Contributions stop being accepted after this date."}
              />
            </FloatingCard>

            {!isEdit ? (
              <View>
                <Text style={styles.sectionOutside}>Supplier</Text>
                {suppliers.length === 0 ? (
                  <Text style={styles.emptyText}>No verified suppliers in {countryDisplayName(country)} yet.</Text>
                ) : (
                  <View style={{ gap: 8 }}>
                    {suppliers.map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => setSupplierId(s.id)}
                        activeOpacity={0.85}
                        accessibilityRole="radio"
                        accessibilityLabel={s.vendor?.storeName ?? "Supplier"}
                        accessibilityState={{ selected: supplierId === s.id }}
                      >
                        <FloatingCard style={[styles.optionRow, supplierId === s.id && styles.optionRowActive]}>
                          <Ionicons name={supplierId === s.id ? "radio-button-on" : "radio-button-off"} size={18} color={supplierId === s.id ? "#076B51" : "#8AA194"} />
                          <Text style={styles.optionText}>{s.vendor?.storeName ?? "Supplier"}</Text>
                        </FloatingCard>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ) : null}

            {isEdit && campaign?.supplierDeclinedAt ? (
              <View>
                <Text style={styles.sectionOutside}>Choose a new supplier</Text>
                <FloatingCard style={{ gap: 10 }}>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                    <Ionicons name="close-circle-outline" size={18} color="#D6552F" />
                    <Text style={styles.noticeText}>
                      The supplier declined this campaign{campaign.supplierDeclineReason ? `: ${campaign.supplierDeclineReason}` : ""}. Choose a different supplier to continue.
                    </Text>
                  </View>
                  {suppliers.length === 0 ? (
                    <Text style={styles.emptyText}>No other verified suppliers in {countryDisplayName(country)} yet.</Text>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {suppliers.filter((s) => s.id !== campaign.supplierId).map((s) => (
                        <TouchableOpacity
                          key={s.id}
                          onPress={() => void handleReassignSupplier(s.id)}
                          disabled={reassigning}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          accessibilityLabel={`Reassign to ${s.vendor?.storeName ?? "Supplier"}`}
                          accessibilityState={{ busy: reassigning, disabled: reassigning }}
                        >
                          <FloatingCard style={styles.optionRow}>
                            {reassigning ? <ActivityIndicator size="small" color="#076B51" /> : <Ionicons name="radio-button-off" size={18} color="#8AA194" />}
                            <Text style={styles.optionText}>{s.vendor?.storeName ?? "Supplier"}</Text>
                          </FloatingCard>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </FloatingCard>
              </View>
            ) : null}

            {isEdit && participants.length > 0 ? (
              <View>
                <Text style={styles.sectionOutside}>Participants ({participants.length})</Text>
                <FloatingCard style={{ padding: 0, overflow: "hidden" }}>
                  {participants.map((p, index) => (
                    <View key={p.userId} style={[styles.participantRow, index > 0 && styles.participantRowBorder]}>
                      <Text style={styles.optionText}>{p.name}{p.isOrganiser ? " (you)" : ""}</Text>
                      <Text style={styles.fieldHint}>{p.totalQuantity} share{p.totalQuantity === 1 ? "" : "s"} · {formatDisplayMoney(p.totalPaid / 100, currency, selectedCurrency)}</Text>
                    </View>
                  ))}
                </FloatingCard>
              </View>
            ) : null}

            {isEdit && campaign && UPDATE_POSTABLE_STATUSES.includes(campaign.status) ? (
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={styles.sectionOutside}>Campaign updates</Text>
                  <TouchableOpacity
                    onPress={() => setShowUpdateForm((v) => !v)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={showUpdateForm ? "Cancel" : "Post an update"}
                    accessibilityState={{ expanded: showUpdateForm }}
                  >
                    <Text style={styles.linkText}>{showUpdateForm ? "Cancel" : "Post an update"}</Text>
                  </TouchableOpacity>
                </View>

                {showUpdateForm ? (
                  <FloatingCard style={{ gap: 8 }}>
                    <Text style={styles.label}>Title</Text>
                    <TextInput style={styles.input} placeholder="e.g. Shipping this week" placeholderTextColor="#8AA194" value={updateTitleInput} onChangeText={setUpdateTitleInput} maxLength={140} accessibilityLabel="Update title" />
                    <Text style={styles.label}>Message</Text>
                    <TextInput style={[styles.input, styles.inputMultiline]} placeholder="What do participants need to know?" placeholderTextColor="#8AA194" value={updateMessageInput} onChangeText={setUpdateMessageInput} multiline maxLength={2000} accessibilityLabel="Update message" />
                    <Text style={styles.outcomeHint}>Every participant is notified. This is for messages only — it can never change price, minimum, goal or maximum.</Text>
                    <TouchableOpacity
                      onPress={() => void handlePostUpdate()}
                      disabled={postingUpdate}
                      activeOpacity={0.88}
                      style={styles.primaryBtnInline}
                      accessibilityRole="button"
                      accessibilityLabel="Post update"
                      accessibilityState={{ busy: postingUpdate, disabled: postingUpdate }}
                    >
                      {postingUpdate ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.fulfilBtnText}>Post update</Text>}
                    </TouchableOpacity>
                  </FloatingCard>
                ) : null}

                {updates.length > 0 ? (
                  <View style={{ gap: 8 }}>
                    {updates.map((u) => (
                      <FloatingCard key={u.id} style={{ gap: 3 }}>
                        <Text style={styles.updateTitle}>{u.title}</Text>
                        {u.body ? <Text style={styles.fieldHint}>{u.body}</Text> : null}
                        <Text style={styles.updateDate}>{formatDateTime(u.createdAt)}</Text>
                      </FloatingCard>
                    ))}
                  </View>
                ) : !showUpdateForm ? (
                  <Text style={styles.fieldHint}>No updates posted yet.</Text>
                ) : null}
              </View>
            ) : null}

            {!isLocked ? (
              <PrimaryButton label={isEdit ? "Save changes" : "Create campaign"} onPress={() => void handleSave()} loading={saving} />
            ) : null}

            {campaign && ["DRAFT", "CHANGES_REQUIRED"].includes(campaign.status) ? (
              campaign.supplierCommitted ? (
                <View style={{ gap: 12 }}>
                  <View>
                    <Text style={styles.sectionOutside}>Review before you submit</Text>
                    <FloatingCard style={{ gap: 8 }}>
                      <View style={styles.previewRow}><Text style={styles.fieldHint}>Supplier</Text><Text style={styles.previewValue}>{suppliers.find((s) => s.id === supplierId)?.vendor?.storeName ?? "Confirmed supplier"}</Text></View>
                      <View style={styles.previewRow}><Text style={styles.fieldHint}>Participant price</Text><Text style={styles.previewValue}>{formatDisplayMoney(Number(pricePerShare) || 0, currency, selectedCurrency)} / share</Text></View>
                      <View style={styles.previewRow}><Text style={styles.fieldHint}>Minimum / goal / maximum</Text><Text style={styles.previewValue}>{minimumShares || "—"} / {goalShares || "—"} / {maximumShares || "—"}</Text></View>
                      <View style={styles.previewRow}><Text style={styles.fieldHint}>Deadline</Text><Text style={styles.previewValue}>{deadline || "—"}</Text></View>
                      <View style={styles.previewRow}><Text style={styles.fieldHint}>Eki's fee</Text><Text style={styles.previewValue}>{marketConfig?.communityBuyFeeBps != null ? `${(marketConfig.communityBuyFeeBps / 100).toFixed(2)}%` : "Not yet configured"}</Text></View>
                      <Text style={styles.outcomeHint}>Once submitted, an admin reviews this campaign. If changes are needed, you'll see the exact reason and can resubmit.</Text>
                    </FloatingCard>
                  </View>
                  <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={submitting}
                    activeOpacity={0.85}
                    style={styles.secondaryBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Submit for review"
                    accessibilityState={{ busy: submitting, disabled: submitting }}
                  >
                    {submitting ? <ActivityIndicator size="small" color="#076B51" /> : <Text style={styles.secondaryBtnText}>Submit for review</Text>}
                  </TouchableOpacity>
                </View>
              ) : campaign.supplierDeclinedAt ? null : (
                <FloatingCard style={styles.noticeCard}>
                  <Ionicons name="hourglass-outline" size={18} color="#B48A00" />
                  <Text style={styles.noticeText}>Waiting for the supplier to accept this campaign before it can be submitted for review.</Text>
                </FloatingCard>
              )
            ) : null}

            {campaign?.status === "APPROVED" ? (
              <TouchableOpacity
                onPress={handlePublish}
                disabled={publishing}
                activeOpacity={0.85}
                style={styles.secondaryBtn}
                accessibilityRole="button"
                accessibilityLabel="Publish campaign"
                accessibilityState={{ busy: publishing, disabled: publishing }}
              >
                {publishing ? <ActivityIndicator size="small" color="#076B51" /> : <Text style={styles.secondaryBtnText}>Publish campaign</Text>}
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerIconBtn: { width: 38, height: 38, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  thresholdGroup: { gap: 14 },
  thresholdRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  thresholdDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  outcomeExplainerCard: { gap: 4, backgroundColor: "#F4F6F5" },
  outcomeExplainerTitle: { fontSize: 12, fontFamily: "Manrope-ExtraBold", color: "#12221A", marginBottom: 2 },
  outcomeExplainerText: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#4A5A52", lineHeight: 16 },
  feeCard: { gap: 4 },
  feeValue: { fontSize: 18, fontFamily: "Manrope-ExtraBold", color: "#151E1B" },
  previewRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  previewValue: { flex: 1, fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#151E1B", textAlign: "right" },
  noticeCard: { flexDirection: "row", gap: 8, backgroundColor: "rgba(255,197,0,0.14)" },
  noticeText: { flex: 1, fontSize: 12, fontFamily: "Outfit-Regular", color: "#151E1B", lineHeight: 17 },
  outcomeTitle: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#151E1B" },
  outcomeRow: { flexDirection: "row", justifyContent: "space-between" },
  outcomeLabel: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  outcomeValue: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
  outcomeHint: { flex: 1, fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72", lineHeight: 17 },
  decisionRow: { flexDirection: "row", gap: 8 },
  addRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  addRowText: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#076B51" },
  fulfilBtn: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  fulfilBtnText: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  cancelBtn: { flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: "#D6552F", alignItems: "center", justifyContent: "center" },
  cancelBtnText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#D6552F" },
  label: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#516A60", marginBottom: 8 },
  fieldHint: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#8AA194", marginTop: 4 },
  rescueSectionLabel: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#151E1B" },
  quantityRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  quantityInput: { width: 70, backgroundColor: "#F4F6F5", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, fontFamily: "Manrope-Bold", color: "#151E1B", textAlign: "center" },
  extensionForm: { gap: 6, borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 10 },
  checkboxRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 6 },
  checkboxText: { flex: 1, fontSize: 12, fontFamily: "Outfit-Regular", color: "#151E1B", lineHeight: 17 },
  input: { backgroundColor: "#F4F6F5", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Outfit-Regular", color: "#151E1B" },
  inputMultiline: { minHeight: 70, textAlignVertical: "top" },
  sectionOutside: { fontSize: 15, fontFamily: "Manrope-ExtraBold", color: "#12221A", marginBottom: 10 },
  linkText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  updateTitle: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#151E1B" },
  updateDate: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#8AA194", marginTop: 2 },
  emptyText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "transparent" },
  optionRowActive: { borderColor: "#076B51" },
  optionText: { fontSize: 13, fontFamily: "Outfit-Medium", color: "#151E1B" },
  participantRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, gap: 8 },
  participantRowBorder: { borderTopWidth: 1, borderTopColor: "#F0F0F0" },
  primaryBtnInline: { minHeight: 48, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", marginTop: 4 },
  primaryBtnText: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  secondaryBtn: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: "#076B51", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
});
