import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { useFocusRefresh } from "../../hooks/useFocusRefresh";
import { ApiRequestError, NetworkError } from "../../services/api/client";
import {
  ErrorState,
  FloatingCard,
  LoadingBlock,
  PremiumHeader,
  PrimaryButton,
  StatusPill,
  premiumStyles,
} from "../../components/shared/PremiumBlocks";
import {
  supplierOffersService,
  type OfferFulfilment,
  type SupplierOffer,
  type SupplierOfferInput,
} from "../../services/supplierOffersService";

type Step = "list" | "form" | "review";

const WINDOW_DAYS = [7, 14, 30, 60];

const EMPTY_FORM = {
  foodstuffName: "",
  packSize: "",
  imageUrl: "",
  price: "",
  minimumShares: "",
  maximumShares: "",
  windowDays: 30,
  methods: [] as OfferFulfilment[],
  deliveryAreas: "",
  deliveryFee: "",
  collectionAddress: "",
  collectionCity: "",
  collectionPostcode: "",
};

function formatPounds(minor: number): string {
  return `£${(minor / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

function toMinor(value: string): number {
  return Math.round(Number(value) * 100);
}

function submitErrorMessage(err: unknown): string {
  if (err instanceof NetworkError) return "We couldn't submit this. Check your connection and try again.";
  return err instanceof Error ? err.message : "We couldn't submit this. Check your connection and try again.";
}

const STATUS_LABEL: Partial<Record<SupplierOffer["status"], string>> = {
  DRAFT: "Draft",
  IN_REVIEW: "In review",
  INFO_REQUIRED: "Information required",
  APPROVED: "Live",
  REJECTED: "Not approved",
  WITHDRAWN: "Withdrawn",
  SUSPENDED: "Suspended",
};

export default function BulkOffersScreen() {
  const router = useRouter();
  const [offers, setOffers] = useState<SupplierOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [step, setStep] = useState<Step>("list");
  const [editing, setEditing] = useState<SupplierOffer | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [draft, setDraft] = useState<SupplierOffer | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setOffers(await supplierOffersService.listMine());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your offers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusRefresh(load);

  const startNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setActionError("");
    setStep("form");
  };

  const startEdit = (offer: SupplierOffer) => {
    setEditing(offer);
    setForm({
      foodstuffName: offer.foodstuffName,
      packSize: offer.packSize,
      imageUrl: offer.images[0] ?? "",
      price: (offer.pricePerShareMinor / 100).toFixed(2),
      minimumShares: String(offer.minimumShares),
      maximumShares: String(offer.maximumShares),
      windowDays: 30,
      methods: offer.fulfilmentMethods,
      deliveryAreas: offer.deliveryAreas.join(", "),
      deliveryFee: offer.deliveryFeeMinor != null ? (offer.deliveryFeeMinor / 100).toFixed(2) : "",
      collectionAddress: offer.collectionAddressLine1 ?? "",
      collectionCity: offer.collectionCity ?? "",
      collectionPostcode: offer.collectionPostcode ?? "",
    });
    setActionError("");
    setStep("form");
  };

  const goBack = () => {
    setActionError("");
    if (step === "review") setStep("form");
    else if (step === "form") setStep("list");
    else goBackOrReplace(router, "/(supplier)/community-buy-supplier" as any);
  };

  const toggleMethod = (method: OfferFulfilment) => {
    setForm((f) => ({ ...f, methods: f.methods.includes(method) ? f.methods.filter((m) => m !== method) : [...f.methods, method] }));
  };

  // The server validates all of this too: this only saves a round trip.
  const buildInput = (): SupplierOfferInput => {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + form.windowDays);
    return {
      foodstuffName: form.foodstuffName,
      packSize: form.packSize,
      images: form.imageUrl.trim() ? [form.imageUrl.trim()] : [],
      pricePerShareMinor: toMinor(form.price),
      minimumShares: Number(form.minimumShares),
      maximumShares: Number(form.maximumShares),
      windowStartsAt: now.toISOString(),
      windowEndsAt: end.toISOString(),
      fulfilmentMethods: form.methods,
      deliveryAreas: form.deliveryAreas.split(",").map((a) => a.trim()).filter(Boolean),
      deliveryFeeMinor: form.deliveryFee ? toMinor(form.deliveryFee) : undefined,
      collectionAddressLine1: form.collectionAddress,
      collectionCity: form.collectionCity,
      collectionPostcode: form.collectionPostcode,
    };
  };

  const saveDraft = async () => {
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      const saved = editing ? await supplierOffersService.update(editing.id, buildInput()) : await supplierOffersService.create(buildInput());
      setDraft(saved);
      setEditing(saved);
      setStep("review");
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "SUPPLIER_DETAILS_REQUIRED") {
        router.push("/(supplier)/community-buy-supplier" as any);
        return;
      }
      setActionError(err instanceof Error ? err.message : "Could not save this offer.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!draft || busy) return;
    setBusy(true);
    setActionError("");
    try {
      await supplierOffersService.submit(draft.id);
      await load();
      setStep("list");
    } catch (err) {
      setActionError(submitErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (offer: SupplierOffer) => {
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      await supplierOffersService.withdraw(offer.id);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not withdraw this offer.");
    } finally {
      setBusy(false);
    }
  };

  const renderOffer = (offer: SupplierOffer) => (
    <FloatingCard key={offer.id} style={{ gap: 8 }}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle} numberOfLines={1}>{offer.foodstuffName}</Text>
        <StatusPill
          label={STATUS_LABEL[offer.status] ?? offer.status}
          tone={offer.status === "APPROVED" ? "success" : offer.status === "REJECTED" || offer.status === "SUSPENDED" ? "error" : offer.status === "INFO_REQUIRED" ? "warning" : "neutral"}
        />
      </View>
      <Text style={styles.meta}>{offer.packSize} · {formatPounds(offer.pricePerShareMinor)} per share · {offer.minimumShares} to {offer.maximumShares} shares</Text>

      {offer.status === "IN_REVIEW" ? (
        <>
          <Text style={styles.body}>We're checking your offer. Usually within 24 hours.</Text>
          {offer.review ? <Text style={styles.meta}>Submitted {formatDate(offer.review.submittedAt)}</Text> : null}
          <Text style={styles.meta}>Organisers can choose this offer once it's approved.</Text>
          <View style={styles.actions}>
            <SmallButton label="Edit" onPress={() => startEdit(offer)} />
            <SmallButton label="Withdraw" onPress={() => void withdraw(offer)} />
          </View>
        </>
      ) : offer.status === "INFO_REQUIRED" ? (
        <>
          <Text style={styles.body}>We need one more detail before your offer goes live.</Text>
          {offer.review?.infoMessage ? <Text style={styles.notice}>{offer.review.infoMessage}</Text> : null}
          <View style={styles.actions}><SmallButton label="Fix and resubmit" onPress={() => startEdit(offer)} /></View>
        </>
      ) : offer.status === "REJECTED" ? (
        <>
          <Text style={styles.body}>{offer.foodstuffName} wasn't approved: {offer.review?.decisionReason ?? "please contact support"}. You can edit and resubmit.</Text>
          <View style={styles.actions}><SmallButton label="Edit and resubmit" onPress={() => startEdit(offer)} /></View>
        </>
      ) : offer.status === "WITHDRAWN" ? (
        <>
          <Text style={styles.body}>Withdrawn. Your draft is saved.</Text>
          <View style={styles.actions}><SmallButton label="Resume draft" onPress={() => startEdit(offer)} /></View>
        </>
      ) : offer.status === "APPROVED" ? (
        <>
          <Text style={styles.body}>Your offer is live. Organisers can now build Community Buys on it.</Text>
          <View style={styles.actions}><SmallButton label="Change offer" onPress={() => startEdit(offer)} /></View>
        </>
      ) : offer.status === "SUSPENDED" ? (
        <Text style={styles.body}>This offer is paused. Contact support to resolve this. Your other Eki activity keeps working.</Text>
      ) : (
        <View style={styles.actions}><SmallButton label="Continue" onPress={() => startEdit(offer)} /></View>
      )}
    </FloatingCard>
  );

  const renderList = () => (
    <>
      <FloatingCard style={{ gap: 10 }}>
        <Text style={styles.stepTitle}>Supply bulk orders</Text>
        <Text style={styles.body}>Supply foodstuff in bulk to Community Buys. You set the price and the minimum; nothing ships until the minimum is reached.</Text>
        <PrimaryButton label="Create offer" icon="add" onPress={startNew} />
      </FloatingCard>
      {offers.map(renderOffer)}
    </>
  );

  const renderForm = () => (
    <>
      <Text style={styles.stepTitle}>Create offer</Text>
      <Field label="Foodstuff" value={form.foodstuffName} onChange={(v) => setForm((f) => ({ ...f, foodstuffName: v }))} placeholder="e.g. Puna yam" />
      <Field label="Pack size and weight" value={form.packSize} onChange={(v) => setForm((f) => ({ ...f, packSize: v }))} placeholder="e.g. 10kg box" />
      <Field label="Photo link" value={form.imageUrl} onChange={(v) => setForm((f) => ({ ...f, imageUrl: v }))} placeholder="https://" />
      <Field label="Price per share (£)" value={form.price} onChange={(v) => setForm((f) => ({ ...f, price: v }))} placeholder="0.00" keyboardType="decimal-pad" />
      <View style={styles.twoCols}>
        <View style={{ flex: 1 }}><Field label="Minimum shares" value={form.minimumShares} onChange={(v) => setForm((f) => ({ ...f, minimumShares: v }))} keyboardType="number-pad" /></View>
        <View style={{ flex: 1 }}><Field label="Maximum shares" value={form.maximumShares} onChange={(v) => setForm((f) => ({ ...f, maximumShares: v }))} keyboardType="number-pad" /></View>
      </View>

      <Text style={styles.label}>Offer window</Text>
      <View style={styles.chips}>
        {WINDOW_DAYS.map((days) => (
          <Chip key={days} label={`${days} days`} selected={form.windowDays === days} onPress={() => setForm((f) => ({ ...f, windowDays: days }))} />
        ))}
      </View>

      <Text style={styles.label}>Delivery or collection</Text>
      <View style={styles.chips}>
        <Chip label="Delivery" selected={form.methods.includes("DELIVERY")} onPress={() => toggleMethod("DELIVERY")} />
        <Chip label="Collection" selected={form.methods.includes("COLLECTION")} onPress={() => toggleMethod("COLLECTION")} />
      </View>

      {form.methods.includes("DELIVERY") ? (
        <>
          <Field label="Postcode areas you deliver to" value={form.deliveryAreas} onChange={(v) => setForm((f) => ({ ...f, deliveryAreas: v }))} placeholder="e.g. CV1, B1, LE1" />
          <Field label="Delivery charge (£)" value={form.deliveryFee} onChange={(v) => setForm((f) => ({ ...f, deliveryFee: v }))} placeholder="0.00" keyboardType="decimal-pad" />
        </>
      ) : null}
      {form.methods.includes("COLLECTION") ? (
        <>
          <Field label="Collection address" value={form.collectionAddress} onChange={(v) => setForm((f) => ({ ...f, collectionAddress: v }))} />
          <Field label="City" value={form.collectionCity} onChange={(v) => setForm((f) => ({ ...f, collectionCity: v }))} />
          <Field label="Postcode" value={form.collectionPostcode} onChange={(v) => setForm((f) => ({ ...f, collectionPostcode: v }))} />
        </>
      ) : null}
      <PrimaryButton label="Continue" onPress={() => void saveDraft()} loading={busy} />
    </>
  );

  const renderReview = () =>
    draft ? (
      <>
        <Text style={styles.stepTitle}>Review and submit</Text>
        <FloatingCard style={{ gap: 10 }}>
          <Fact label="Foodstuff" value={draft.foodstuffName} />
          <Fact label="Pack size" value={draft.packSize} />
          <Fact label="Price per share" value={formatPounds(draft.pricePerShareMinor)} />
          <Fact label="Minimum and maximum shares" value={`${draft.minimumShares} to ${draft.maximumShares}`} />
          <Fact label="Offer window" value={`${formatDate(draft.windowStartsAt)} to ${formatDate(draft.windowEndsAt)}`} />
          <Fact label="Delivery or collection" value={draft.fulfilmentMethods.map((m) => (m === "DELIVERY" ? "Delivery" : "Collection")).join(" and ")} />
        </FloatingCard>
        <Text style={styles.body}>Organisers can choose this offer once it's approved.</Text>
        <PrimaryButton label="Submit" onPress={() => void submit()} loading={busy} />
      </>
    ) : null;

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title="Supply bulk orders" onBack={goBack} />
      {loading && offers.length === 0 && step === "list" ? (
        <LoadingBlock />
      ) : error ? (
        <View style={premiumStyles.block}><ErrorState message={error} onRetry={() => void load()} /></View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={[premiumStyles.block, { gap: 14 }]}>
            {step === "list" ? renderList() : step === "form" ? renderForm() : renderReview()}
            {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; keyboardType?: "decimal-pad" | "number-pad" }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#8AA194" keyboardType={keyboardType} style={styles.input} accessibilityLabel={label} />
    </View>
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

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.chip, selected && styles.chipActive]} accessibilityRole="button" accessibilityState={{ selected }}>
      {selected ? <Ionicons name="checkmark" size={13} color="#FFFFFF" /> : null}
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.smallBtn} accessibilityRole="button">
      <Text style={styles.smallBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  stepTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#151E1B" },
  cardTitle: { flex: 1, fontSize: 15, fontFamily: "Inter_700Bold", color: "#151E1B" },
  body: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#516A60", lineHeight: 19 },
  meta: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6A7B72", lineHeight: 17 },
  notice: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#8A6A00", backgroundColor: "rgba(255,197,0,0.14)", borderRadius: 12, padding: 10, lineHeight: 18 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#12221A" },
  factValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#151E1B" },
  error: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#D6552F", textAlign: "center" },
  input: { backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8E4", paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontFamily: "Inter_400Regular", color: "#151E1B" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  twoCols: { flexDirection: "row", gap: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8E4" },
  chipActive: { backgroundColor: "#076B51", borderColor: "#076B51" },
  chipText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#516A60" },
  chipTextActive: { color: "#FFFFFF" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  smallBtn: { borderWidth: 1, borderColor: "#DCE3DF", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  smallBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#076B51" },
});
