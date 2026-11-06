import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { ApiRequestError, NetworkError } from "../../services/api/client";
import { useLaunchSettings } from "../../services/launchSettingsService";
import { communityBuyService } from "../../services/communityBuyService";
import {
  EmptyState,
  ErrorState,
  FloatingCard,
  LoadingBlock,
  PremiumHeader,
  PrimaryButton,
  premiumStyles,
} from "../../components/shared/PremiumBlocks";
import {
  supplierOffersService,
  type OfferCampaign,
  type OfferCard,
  type OfferFulfilment,
} from "../../services/supplierOffersService";

type Step = "choose" | "details" | "review" | "missing" | "live" | "inReview";

const DEADLINE_DAYS = [3, 7, 14, 21, 28];
const METHOD_LABEL: Record<OfferFulfilment, string> = { DELIVERY: "Delivery", COLLECTION: "Collection" };

// Phase 1's approved wording describes a hold. It's only true once the campaign really uses one.
const HOLD_PAYMENT_LINE = "No payment is taken when you join. A temporary hold is placed shortly before the deadline, and you're only charged if the Community Buy goes ahead.";
const PLEDGE_PAYMENT_LINE = "No payment is taken when you join. Participants are only charged if the Community Buy goes ahead.";

function pounds(minor: number): string {
  return `£${(minor / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "long" });
}

function deadlineOptions(windowEndsAt: string): string[] {
  const end = new Date(windowEndsAt).getTime();
  const options = DEADLINE_DAYS.map((days) => new Date(Date.now() + days * 86_400_000).getTime()).filter((t) => t < end).map((t) => new Date(t).toISOString());
  return options.length > 0 ? options : [windowEndsAt];
}

export default function OfferCampaignScreen() {
  const router = useRouter();
  const { campaignReviewHours } = useLaunchSettings();
  const { id: resumeId } = useLocalSearchParams<{ id?: string }>();
  const [step, setStep] = useState<Step>("choose");
  const [offers, setOffers] = useState<OfferCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [offer, setOffer] = useState<OfferCard | null>(null);
  const [campaign, setCampaign] = useState<OfferCampaign | null>(null);
  const [goal, setGoal] = useState(0);
  const [deadline, setDeadline] = useState("");
  const [method, setMethod] = useState<OfferFulfilment>("COLLECTION");
  const [groupName, setGroupName] = useState("");

  const [foodstuff, setFoodstuff] = useState("");
  const [requested, setRequested] = useState(false);

  const [missing, setMissing] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setOffers(await supplierOffersService.listForOrganisers());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load bulk offers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Drafts save after every step, so opening one from My Community Buys continues it.
  const resumed = useRef(false);
  useEffect(() => {
    if (!resumeId || resumed.current || offers.length === 0) return;
    resumed.current = true;
    void guarded(async () => {
      const draft = await communityBuyService.getCampaign(resumeId);
      const card = offers.find((candidate) => candidate.id === draft.supplierOfferId);
      if (!card) {
        setError("This offer isn't available any more. Choose another to continue.");
        return;
      }
      setOffer(card);
      setCampaign(draft as unknown as OfferCampaign);
      setGoal(draft.goalShares ?? card.maximumShares);
      setDeadline(draft.deadline ?? deadlineOptions(card.windowEndsAt)[0]);
      setMethod(card.fulfilmentMethods[0]);
      setGroupName(draft.title);
      setStep("details");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId, offers]);

  const guarded = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      if (err instanceof NetworkError) setError("We couldn't submit this. Check your connection and try again.");
      else setError(err instanceof Error ? err.message : "That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const chooseOffer = (card: OfferCard) =>
    guarded(async () => {
      const draft = await supplierOffersService.createCampaign(card.id);
      setOffer(card);
      setCampaign(draft);
      setGoal(draft.goalShares ?? card.maximumShares);
      setDeadline(deadlineOptions(card.windowEndsAt)[0]);
      setMethod(card.fulfilmentMethods[0]);
      setGroupName(draft.title);
      setStep("details");
    });

  const saveDetails = () =>
    guarded(async () => {
      if (!campaign) return;
      setCampaign(await supplierOffersService.updateCampaign(campaign.id, { groupName, goalShares: goal, deadline, fulfilmentMethod: method }));
      setStep("review");
    });

  const submit = () =>
    guarded(async () => {
      if (!campaign) return;
      try {
        const result = await supplierOffersService.submitCampaign(campaign.id);
        setCampaign(result.campaign);
        setStep(result.outcome === "LIVE" ? "live" : "inReview");
      } catch (err) {
        if (err instanceof ApiRequestError && err.code === "ORGANISER_CHECKS_MISSING") {
          setMissing((err.details as { missing?: string[] } | undefined)?.missing ?? []);
          setStep("missing");
          return;
        }
        throw err;
      }
    });

  const confirmCode = () =>
    guarded(async () => {
      const result = await supplierOffersService.confirmPhoneCode(code);
      setMissing(result.missing);
      if (result.missing.length > 0 || !campaign) return;
      // Submit resumes on its own once nothing is missing.
      const submitted = await supplierOffersService.submitCampaign(campaign.id);
      setCampaign(submitted.campaign);
      setStep(submitted.outcome === "LIVE" ? "live" : "inReview");
    });

  const withdraw = () =>
    guarded(async () => {
      if (!campaign) return;
      setCampaign(await supplierOffersService.withdrawCampaign(campaign.id));
      setStep("review");
    });

  const goBack = () => {
    setError("");
    if (step === "details") setStep("choose");
    else if (step === "review") setStep("details");
    else if (step === "missing") setStep("review");
    else if (step === "choose") goBackOrReplace(router, "/(buyer)/community-buy" as any);
    else router.replace("/(buyer)/my-community-buys" as any);
  };

  const share = () => {
    if (campaign) router.push({ pathname: "/(buyer)/community-buy-share", params: { id: campaign.id } } as any);
  };

  const renderChoose = () => (
    <>
      <Text style={styles.stepLabel}>Step 1 of 4</Text>
      <Text style={styles.stepTitle}>Choose an offer</Text>
      {loading ? (
        <LoadingBlock />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={() => void load()} />
      ) : offers.length === 0 ? (
        <FloatingCard style={{ gap: 12 }}>
          <EmptyState icon="basket-outline" title="No bulk offers in your area yet." body="Tell us what you'd like to buy together" />
          {requested ? (
            <Text style={styles.confirmation}>Thanks. We've saved your request.</Text>
          ) : (
            <>
              <TextInput value={foodstuff} onChangeText={setFoodstuff} placeholder="e.g. Puna yam" placeholderTextColor="#8AA194" style={styles.input} accessibilityLabel="Foodstuff" />
              <PrimaryButton
                label="Request a foodstuff"
                loading={busy}
                onPress={() => void guarded(async () => { await supplierOffersService.requestFoodstuff(foodstuff); setRequested(true); })}
              />
            </>
          )}
        </FloatingCard>
      ) : (
        offers.map((card) => (
          <TouchableOpacity key={card.id} onPress={() => void chooseOffer(card)} disabled={busy} activeOpacity={0.85} accessibilityRole="button">
            <FloatingCard style={{ gap: 6 }}>
              <Text style={styles.cardTitle}>{card.foodstuffName}</Text>
              <View style={styles.supplierRow}>
                <Text style={styles.meta}>{card.supplierName}</Text>
                <View style={styles.badge}>
                  <Ionicons name="checkmark-circle" size={12} color="#076B51" />
                  <Text style={styles.badgeText}>Verified Supplier</Text>
                </View>
              </View>
              <Text style={styles.price}>{pounds(card.pricePerShareMinor)} per share</Text>
              <Text style={styles.meta}>{card.minimumShares} to {card.maximumShares} shares · {card.fulfilmentMethods.map((m) => METHOD_LABEL[m]).join(" or ")}</Text>
            </FloatingCard>
          </TouchableOpacity>
        ))
      )}
      {busy ? <ActivityIndicator color="#076B51" /> : null}
    </>
  );

  const renderDetails = () =>
    offer ? (
      <>
        <Text style={styles.stepLabel}>Step 2 of 4</Text>
        <Text style={styles.stepTitle}>Campaign details</Text>

        <Text style={styles.label}>Goal (shares)</Text>
        <View style={styles.stepper}>
          <TouchableOpacity onPress={() => setGoal((g) => Math.max(offer.minimumShares, g - 1))} style={styles.stepperBtn} accessibilityRole="button" accessibilityLabel="Fewer shares">
            <Ionicons name="remove" size={18} color="#076B51" />
          </TouchableOpacity>
          <Text style={styles.stepperValue}>{goal}</Text>
          <TouchableOpacity onPress={() => setGoal((g) => Math.min(offer.maximumShares, g + 1))} style={styles.stepperBtn} accessibilityRole="button" accessibilityLabel="More shares">
            <Ionicons name="add" size={18} color="#076B51" />
          </TouchableOpacity>
        </View>
        <Text style={styles.meta}>Between {offer.minimumShares} and {offer.maximumShares}, set by the supplier.</Text>

        <Text style={styles.label}>Deadline</Text>
        <View style={{ gap: 8 }}>
          {deadlineOptions(offer.windowEndsAt).map((date) => (
            <Option key={date} selected={deadline === date} label={formatDate(date)} onPress={() => setDeadline(date)} />
          ))}
        </View>

        {offer.fulfilmentMethods.length > 1 ? (
          <>
            <Text style={styles.label}>Delivery or collection</Text>
            <View style={{ gap: 8 }}>
              {offer.fulfilmentMethods.map((m) => <Option key={m} selected={method === m} label={METHOD_LABEL[m]} onPress={() => setMethod(m)} />)}
            </View>
          </>
        ) : (
          <Text style={styles.meta}>{METHOD_LABEL[offer.fulfilmentMethods[0]]}{offer.collectionCity ? ` in ${offer.collectionCity}` : ""}</Text>
        )}

        <Text style={styles.label}>Group name</Text>
        <TextInput value={groupName} onChangeText={setGroupName} placeholderTextColor="#8AA194" style={styles.input} accessibilityLabel="Group name" />
        <PrimaryButton label="Continue" onPress={() => void saveDetails()} loading={busy} />
      </>
    ) : null;

  const renderReview = () =>
    offer && campaign ? (
      <>
        <Text style={styles.stepLabel}>Step 3 of 4</Text>
        <Text style={styles.stepTitle}>Review</Text>
        <FloatingCard style={{ gap: 10 }}>
          <Fact label="Offer" value={`${offer.foodstuffName}, ${offer.packSize}`} />
          <Fact label="Supplier" value={offer.supplierName} />
          <Fact label="Price per share" value={pounds(offer.pricePerShareMinor)} />
          <Fact label="Minimum" value={String(offer.minimumShares)} />
          <Fact label="Goal" value={String(goal)} />
          <Fact label="Maximum" value={String(offer.maximumShares)} />
          <Fact label="Deadline" value={formatDate(deadline)} />
          <Fact label="Delivery" value={METHOD_LABEL[method]} />
        </FloatingCard>
        <Text style={styles.notice}>Once someone joins, the price, quantities and deadline can't change.</Text>
        <Text style={styles.body}>{campaign.paymentMode === "AUTHORISE_THEN_CAPTURE" ? HOLD_PAYMENT_LINE : PLEDGE_PAYMENT_LINE}</Text>
        <PrimaryButton label="Submit" onPress={() => void submit()} loading={busy} />
      </>
    ) : null;

  const renderMissing = () => (
    <>
      <Text style={styles.stepTitle}>{missing.includes("phone") ? "Verify your phone number" : "Verify your email"}</Text>
      <Text style={styles.body}>Your draft is saved.</Text>
      {missing.includes("phone") ? (
        codeSent ? (
          <>
            <TextInput value={code} onChangeText={setCode} placeholder="6-digit code" placeholderTextColor="#8AA194" keyboardType="number-pad" style={styles.input} accessibilityLabel="Code" />
            <PrimaryButton label="Verify" onPress={() => void confirmCode()} loading={busy} />
          </>
        ) : (
          <>
            <TextInput value={phone} onChangeText={setPhone} placeholder="+447700900000" placeholderTextColor="#8AA194" keyboardType="phone-pad" style={styles.input} accessibilityLabel="Phone number" />
            <PrimaryButton
              label="Send code"
              loading={busy}
              onPress={() => void guarded(async () => { await supplierOffersService.sendPhoneCode(phone); setCodeSent(true); })}
            />
          </>
        )
      ) : (
        <>
          <Text style={styles.body}>Open the link in the email we sent you, then come back and submit.</Text>
          <PrimaryButton label="Submit" onPress={() => void submit()} loading={busy} />
        </>
      )}
    </>
  );

  const renderLive = () => (
    <>
      <View style={styles.resultIcon}><Ionicons name="checkmark-circle" size={56} color="#076B51" /></View>
      <Text style={[styles.stepTitle, styles.center]}>Your Community Buy is live.</Text>
      <PrimaryButton label="Share" icon="share-social-outline" onPress={share} />
      <TouchableOpacity onPress={() => router.replace("/(buyer)/my-community-buys" as any)} style={styles.linkBtn} accessibilityRole="button">
        <Text style={styles.linkText}>My Community Buys</Text>
      </TouchableOpacity>
    </>
  );

  const renderInReview = () => (
    <>
      <View style={styles.resultIcon}><Ionicons name="time-outline" size={56} color="#076B51" /></View>
      <Text style={[styles.stepTitle, styles.center]}>We're checking your Community Buy. Usually within {campaignReviewHours} hours.</Text>
      <Text style={[styles.body, styles.center]}>You can share a coming soon link now. People can show interest, and nobody pays anything.</Text>
      <PrimaryButton label="Share preview" onPress={share} />
      <View style={styles.actionRow}>
        <TouchableOpacity onPress={() => setStep("details")} style={styles.linkBtn} accessibilityRole="button"><Text style={styles.linkText}>Edit</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => void withdraw()} style={styles.linkBtn} accessibilityRole="button"><Text style={styles.linkText}>Withdraw</Text></TouchableOpacity>
      </View>
    </>
  );

  const body = { choose: renderChoose, details: renderDetails, review: renderReview, missing: renderMissing, live: renderLive, inReview: renderInReview }[step];

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title="Create a Community Buy" onBack={goBack} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={[premiumStyles.block, { gap: 14 }]}>
          {body()}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </ScrollView>
    </View>
  );
}

function Option({ selected, label, onPress }: { selected: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="radio" accessibilityState={{ selected }}>
      <FloatingCard style={[styles.option, selected && styles.optionActive]}>
        <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={18} color={selected ? "#076B51" : "#C7D2CB"} />
        <Text style={styles.factValue}>{label}</Text>
      </FloatingCard>
    </TouchableOpacity>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={styles.meta}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stepLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#076B51" },
  stepTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#151E1B", marginTop: -8 },
  center: { textAlign: "center", marginTop: 0 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#151E1B" },
  price: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#151E1B" },
  body: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#516A60", lineHeight: 19 },
  meta: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6A7B72", lineHeight: 17 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#12221A" },
  factValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#151E1B", flexShrink: 1 },
  notice: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#8A6A00", backgroundColor: "rgba(255,197,0,0.14)", borderRadius: 12, padding: 10, lineHeight: 18 },
  confirmation: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#076B51", textAlign: "center" },
  error: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#D6552F", textAlign: "center" },
  input: { backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8E4", paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontFamily: "Inter_400Regular", color: "#151E1B" },
  supplierRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  badge: { flexDirection: "row", alignItems: "center", gap: 3 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#076B51" },
  stepper: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 14, backgroundColor: "#F0F3F1", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  stepperBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  stepperValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#151E1B", minWidth: 28, textAlign: "center" },
  option: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderColor: "transparent" },
  optionActive: { borderColor: "#076B51" },
  resultIcon: { alignItems: "center", marginTop: 24 },
  actionRow: { flexDirection: "row", justifyContent: "center", gap: 24 },
  linkBtn: { alignItems: "center", paddingVertical: 8 },
  linkText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#076B51" },
});
