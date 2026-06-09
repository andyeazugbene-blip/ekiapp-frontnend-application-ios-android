import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { adminService, type AdminCommissionTier, type AdminSellerPlan } from "../../services/adminService";
import { goBackOrReplace } from "../../utils/navigation";

const BRAND = "#076B51";
const BG = "#F3F4F3";
const TEXT = "#282828";
const MUTED = "#858585";
const BORDER = "#E5E7E6";

type TierDraft = {
  id?: string;
  label: string;
  min: string;
  max: string;
  fee: string;
  isActive: boolean;
};

type PlanDraft = {
  id?: string;
  slug: string;
  name: string;
  description: string;
  currency: string;
  price: string;
  stripePriceId: string;
  platformFee: string;
  withdrawalFee: string;
  maxProducts: string;
  maxImagesPerProduct: string;
  displayOrder: string;
  analytics: boolean;
  prioritySupport: boolean;
  flashSales: boolean;
  bundles: boolean;
  discounts: boolean;
  marketingTools: boolean;
  canReceiveOrders: boolean;
  isActive: boolean;
  tiers: TierDraft[];
};

function percentFromBps(bps: number) {
  return (bps / 100).toString();
}

function centsToUnit(cents: number) {
  return (cents / 100).toString();
}

function toCents(value: string) {
  return Math.max(0, Math.round((Number(value.replace(",", ".")) || 0) * 100));
}

function toBps(value: string) {
  return Math.max(0, Math.round((Number(value.replace(",", ".")) || 0) * 100));
}

function emptyDraft(): PlanDraft {
  return {
    slug: "",
    name: "",
    description: "",
    currency: "GBP",
    price: "0",
    stripePriceId: "",
    platformFee: "15",
    withdrawalFee: "2.5",
    maxProducts: "25",
    maxImagesPerProduct: "5",
    displayOrder: "0",
    analytics: false,
    prioritySupport: false,
    flashSales: false,
    bundles: false,
    discounts: false,
    marketingTools: false,
    canReceiveOrders: true,
    isActive: true,
    tiers: [{ label: "Default", min: "0", max: "", fee: "15", isActive: true }],
  };
}

function draftFromPlan(plan: AdminSellerPlan): PlanDraft {
  return {
    id: plan.id,
    slug: plan.slug,
    name: plan.name,
    description: plan.description ?? "",
    currency: plan.currency,
    price: centsToUnit(plan.monthlyPriceCents),
    stripePriceId: plan.stripePriceId ?? "",
    platformFee: percentFromBps(plan.defaultPlatformFeeBps),
    withdrawalFee: percentFromBps(plan.withdrawalFeeBps),
    maxProducts: String(plan.maxProducts),
    maxImagesPerProduct: String(plan.maxImagesPerProduct),
    displayOrder: String(plan.displayOrder),
    analytics: plan.analytics,
    prioritySupport: plan.prioritySupport,
    flashSales: plan.flashSales,
    bundles: plan.bundles,
    discounts: plan.discounts,
    marketingTools: plan.marketingTools,
    canReceiveOrders: plan.canReceiveOrders,
    isActive: plan.isActive,
    tiers: plan.commissionTiers.length
      ? plan.commissionTiers.map((tier) => ({
          id: tier.id,
          label: tier.label ?? "",
          min: centsToUnit(tier.minSubtotalCents),
          max: tier.maxSubtotalCents == null ? "" : centsToUnit(tier.maxSubtotalCents),
          fee: percentFromBps(tier.platformFeeBps),
          isActive: tier.isActive,
        }))
      : [{ label: "Default", min: "0", max: "", fee: percentFromBps(plan.defaultPlatformFeeBps), isActive: true }],
  };
}

export default function AdminSellerPlansScreen() {
  const router = useRouter();
  const [plans, setPlans] = useState<AdminSellerPlan[]>([]);
  const [draft, setDraft] = useState<PlanDraft>(emptyDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const activePlan = useMemo(() => plans.find((plan) => plan.id === draft.id), [plans, draft.id]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await adminService.getSellerPlans();
      setPlans(result);
      if (!draft.id && result[0]) setDraft(draftFromPlan(result[0]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load seller plans.");
    } finally {
      setLoading(false);
    }
  }, [draft.id]);

  useEffect(() => {
    load();
  }, [load]);

  function updateTier(index: number, patch: Partial<TierDraft>) {
    setDraft((current) => ({
      ...current,
      tiers: current.tiers.map((tier, tierIndex) => (tierIndex === index ? { ...tier, ...patch } : tier)),
    }));
  }

  function removeTier(index: number) {
    setDraft((current) => ({
      ...current,
      tiers: current.tiers.length <= 1 ? current.tiers : current.tiers.filter((_, tierIndex) => tierIndex !== index),
    }));
  }

  async function save() {
    if (!draft.slug.trim() || !draft.name.trim()) {
      Alert.alert("Missing plan details", "Add a plan name and slug.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const tiers: AdminCommissionTier[] = draft.tiers.map((tier, index) => ({
        id: tier.id,
        label: tier.label.trim() || null,
        minSubtotalCents: toCents(tier.min),
        maxSubtotalCents: tier.max.trim() ? toCents(tier.max) : null,
        platformFeeBps: toBps(tier.fee),
        isActive: tier.isActive,
        displayOrder: index,
      }));

      const saved = await adminService.saveSellerPlan({
        id: draft.id,
        slug: draft.slug.trim().toLowerCase(),
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        currency: draft.currency.trim().toUpperCase() || "GBP",
        monthlyPriceCents: toCents(draft.price),
        stripePriceId: draft.stripePriceId.trim() || null,
        defaultPlatformFeeBps: toBps(draft.platformFee),
        platformFeeBps: toBps(draft.platformFee),
        withdrawalFeeBps: toBps(draft.withdrawalFee),
        maxProducts: Number(draft.maxProducts) || 0,
        maxImagesPerProduct: Math.max(1, Number(draft.maxImagesPerProduct) || 1),
        maxOrders: null,
        analytics: draft.analytics,
        prioritySupport: draft.prioritySupport,
        flashSales: draft.flashSales,
        bundles: draft.bundles,
        discounts: draft.discounts,
        marketingTools: draft.marketingTools,
        canReceiveOrders: draft.canReceiveOrders,
        isActive: draft.isActive,
        displayOrder: Number(draft.displayOrder) || 0,
        commissionTiers: tiers,
      });
      setPlans((current) => [saved, ...current.filter((plan) => plan.id !== saved.id)].sort((a, b) => a.displayOrder - b.displayOrder));
      setDraft(draftFromPlan(saved));
      Alert.alert("Seller plan saved", `${saved.name} is now updated.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save seller plan.");
    } finally {
      setSaving(false);
    }
  }

  async function deactivate() {
    if (!activePlan) return;
    Alert.alert("Deactivate seller plan", `Deactivate ${activePlan.name}? Vendors already on this plan keep their snapshot history.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Deactivate",
        style: "destructive",
        onPress: async () => {
          try {
            const updated = await adminService.deleteSellerPlan(activePlan.id);
            setPlans((current) => current.map((plan) => (plan.id === updated.id ? updated : plan)).filter((plan) => !plan.deletedAt));
            setDraft(emptyDraft());
          } catch (err) {
            Alert.alert("Could not deactivate", err instanceof Error ? err.message : "Please try again.");
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(admin)/settings" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={21} color={BRAND} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Seller plans</Text>
          <Text style={styles.subtitle}>Website subscriptions, commission tiers, limits, and tools</Text>
        </View>
        <TouchableOpacity onPress={() => setDraft(emptyDraft())} activeOpacity={0.85} style={styles.addButton}>
          <Ionicons name="add" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={BRAND} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.planRail}>
            {plans.map((plan) => (
              <TouchableOpacity
                key={plan.id}
                onPress={() => setDraft(draftFromPlan(plan))}
                activeOpacity={0.85}
                style={[styles.planChip, draft.id === plan.id && styles.planChipActive]}
              >
                <Text style={[styles.planChipText, draft.id === plan.id && styles.planChipTextActive]}>{plan.name}</Text>
                <Text style={[styles.planChipMeta, draft.id === plan.id && styles.planChipTextActive]}>
                  {plan.platformFeePercent} / {plan.withdrawalFeePercent}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{draft.id ? "Edit seller plan" : "Create seller plan"}</Text>
            <Field label="Name" value={draft.name} onChangeText={(name) => setDraft((current) => ({ ...current, name }))} />
            <Field label="Slug" value={draft.slug} onChangeText={(slug) => setDraft((current) => ({ ...current, slug }))} autoCapitalize="none" />
            <Field label="Description" value={draft.description} onChangeText={(description) => setDraft((current) => ({ ...current, description }))} multiline />
            <View style={styles.grid}>
              <Field label="Currency" value={draft.currency} onChangeText={(currency) => setDraft((current) => ({ ...current, currency }))} width="48%" />
              <Field label="Monthly price" value={draft.price} onChangeText={(price) => setDraft((current) => ({ ...current, price }))} keyboardType="decimal-pad" width="48%" />
              <Field label="Platform fee %" value={draft.platformFee} onChangeText={(platformFee) => setDraft((current) => ({ ...current, platformFee }))} keyboardType="decimal-pad" width="48%" />
              <Field label="Withdrawal fee %" value={draft.withdrawalFee} onChangeText={(withdrawalFee) => setDraft((current) => ({ ...current, withdrawalFee }))} keyboardType="decimal-pad" width="48%" />
              <Field label="Products limit" value={draft.maxProducts} onChangeText={(maxProducts) => setDraft((current) => ({ ...current, maxProducts }))} keyboardType="number-pad" width="48%" />
              <Field label="Images / product" value={draft.maxImagesPerProduct} onChangeText={(maxImagesPerProduct) => setDraft((current) => ({ ...current, maxImagesPerProduct }))} keyboardType="number-pad" width="48%" />
            </View>
            <Field label="Stripe price ID (optional)" value={draft.stripePriceId} onChangeText={(stripePriceId) => setDraft((current) => ({ ...current, stripePriceId }))} autoCapitalize="none" />

            <Toggle label="Active plan" value={draft.isActive} onValueChange={(isActive) => setDraft((current) => ({ ...current, isActive }))} />
            <Toggle label="Can receive orders" value={draft.canReceiveOrders} onValueChange={(canReceiveOrders) => setDraft((current) => ({ ...current, canReceiveOrders }))} />
            <Toggle label="Analytics" value={draft.analytics} onValueChange={(analytics) => setDraft((current) => ({ ...current, analytics }))} />
            <Toggle label="Discounts" value={draft.discounts} onValueChange={(discounts) => setDraft((current) => ({ ...current, discounts }))} />
            <Toggle label="Marketing tools" value={draft.marketingTools} onValueChange={(marketingTools) => setDraft((current) => ({ ...current, marketingTools }))} />
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Commission tiers</Text>
              <TouchableOpacity
                onPress={() => setDraft((current) => ({ ...current, tiers: [...current.tiers, { label: "", min: "0", max: "", fee: current.platformFee, isActive: true }] }))}
                activeOpacity={0.85}
                style={styles.smallButton}
              >
                <Text style={styles.smallButtonText}>Add tier</Text>
              </TouchableOpacity>
            </View>
            {draft.tiers.map((tier, index) => (
              <View key={`${tier.id ?? "new"}-${index}`} style={styles.tierCard}>
                <Field label="Label" value={tier.label} onChangeText={(label) => updateTier(index, { label })} />
                <View style={styles.grid}>
                  <Field label="Min subtotal" value={tier.min} onChangeText={(min) => updateTier(index, { min })} keyboardType="decimal-pad" width="32%" />
                  <Field label="Max subtotal" value={tier.max} onChangeText={(max) => updateTier(index, { max })} keyboardType="decimal-pad" width="32%" />
                  <Field label="Fee %" value={tier.fee} onChangeText={(fee) => updateTier(index, { fee })} keyboardType="decimal-pad" width="32%" />
                </View>
                <View style={styles.tierActions}>
                  <Toggle compact label="Active" value={tier.isActive} onValueChange={(isActive) => updateTier(index, { isActive })} />
                  <TouchableOpacity onPress={() => removeTier(index)} activeOpacity={0.85} style={styles.removeTierButton}>
                    <Text style={styles.removeTierText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity onPress={save} disabled={saving} activeOpacity={0.9} style={[styles.saveButton, saving && { opacity: 0.65 }]}>
            {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
            <Text style={styles.saveButtonText}>Save seller plan</Text>
          </TouchableOpacity>
          {draft.id ? (
            <TouchableOpacity onPress={deactivate} activeOpacity={0.85} style={styles.deactivateButton}>
              <Text style={styles.deactivateText}>Deactivate plan</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string; width?: string }) {
  const { label, width, style, ...inputProps } = props;
  return (
    <View style={[styles.field, width ? { width: width as any } : null]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput {...inputProps} placeholderTextColor="#A4AAA7" style={[styles.input, style]} />
    </View>
  );
}

function Toggle({ label, value, onValueChange, compact }: { label: string; value: boolean; onValueChange: (value: boolean) => void; compact?: boolean }) {
  return (
    <View style={[styles.toggleRow, compact && { borderTopWidth: 0, paddingVertical: 0 }]}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: "#A8DBC7", false: "#D9DCDC" }} thumbColor={value ? BRAND : "#FFFFFF"} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14 },
  backButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 28, fontFamily: "Manrope-ExtraBold", color: TEXT },
  subtitle: { marginTop: 3, fontSize: 12, lineHeight: 18, fontFamily: "Outfit-Regular", color: MUTED },
  addButton: { width: 44, height: 44, borderRadius: 16, backgroundColor: BRAND, alignItems: "center", justifyContent: "center" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 120 },
  planRail: { gap: 10, paddingBottom: 14 },
  planChip: { minWidth: 130, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14, paddingVertical: 12 },
  planChipActive: { backgroundColor: BRAND, borderColor: BRAND },
  planChipText: { fontSize: 14, fontFamily: "Manrope-Bold", color: TEXT },
  planChipMeta: { marginTop: 4, fontSize: 11, fontFamily: "Outfit-Regular", color: MUTED },
  planChipTextActive: { color: "#FFFFFF" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 22, padding: 16, borderWidth: 1, borderColor: BORDER, marginBottom: 14 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 4 },
  cardTitle: { fontSize: 17, fontFamily: "Manrope-Bold", color: TEXT, marginBottom: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#5D6662", marginBottom: 7 },
  input: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: BORDER, backgroundColor: "#FAFBFA", paddingHorizontal: 12, color: TEXT, fontFamily: "Outfit-Regular", fontSize: 14 },
  toggleRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#F0F2F1" },
  toggleLabel: { fontSize: 14, fontFamily: "Outfit-Regular", color: TEXT },
  smallButton: { borderRadius: 12, borderWidth: 1, borderColor: BRAND, paddingHorizontal: 12, paddingVertical: 8 },
  smallButtonText: { color: BRAND, fontSize: 12, fontFamily: "Manrope-Bold" },
  tierCard: { borderRadius: 16, backgroundColor: "#F7FAF8", borderWidth: 1, borderColor: "#E2EAE6", padding: 12, marginTop: 10 },
  tierActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  removeTierButton: { paddingHorizontal: 12, paddingVertical: 8 },
  removeTierText: { color: "#FB6363", fontSize: 12, fontFamily: "Manrope-Bold" },
  error: { color: "#FB6363", fontSize: 13, lineHeight: 18, fontFamily: "Outfit-Regular", marginBottom: 12, textAlign: "center" },
  saveButton: { minHeight: 56, borderRadius: 17, backgroundColor: BRAND, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  saveButtonText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Manrope-Bold" },
  deactivateButton: { minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: "#FFB5B5", alignItems: "center", justifyContent: "center", marginTop: 10 },
  deactivateText: { color: "#FB6363", fontSize: 15, fontFamily: "Manrope-Bold" },
});
