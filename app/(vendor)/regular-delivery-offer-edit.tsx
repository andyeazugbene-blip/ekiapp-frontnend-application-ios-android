import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { productService } from "../../services/productService";
import { Product } from "../../types/product";
import {
  ErrorState,
  FloatingCard,
  LoadingBlock,
  OutlineButton,
  PremiumHeader,
  PrimaryButton,
  StatusPill,
  premiumStyles,
} from "../../components/shared/PremiumBlocks";
import {
  regularDeliveriesService,
  FREQUENCY_LABELS,
  FULFILMENT_METHOD_LABELS,
  SUBSTITUTION_MODE_LABELS,
  type OfferFulfilmentMethod,
  type OfferSubstitutionMode,
  type SubscriptionFrequency,
} from "../../services/regularDeliveriesService";

const ALL_FREQUENCIES: SubscriptionFrequency[] = ["WEEKLY", "BIWEEKLY", "MONTHLY"];
const ALL_FULFILMENT_METHODS: OfferFulfilmentMethod[] = ["DELIVERY", "COLLECTION"];
const ALL_SUBSTITUTION_MODES: OfferSubstitutionMode[] = ["NO_SUBSTITUTION", "ASK_BUYER", "ALLOW_SIMILAR"];

export default function VendorRegularDeliveryOfferEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [frequencies, setFrequencies] = useState<Set<SubscriptionFrequency>>(new Set(["MONTHLY"]));
  const [substitutionPolicy, setSubstitutionPolicy] = useState("");
  const [substitutionMode, setSubstitutionMode] = useState<OfferSubstitutionMode>("ASK_BUYER");
  const [renewalCutoffHours, setRenewalCutoffHours] = useState("");
  const [fulfilmentMethod, setFulfilmentMethod] = useState<OfferFulfilmentMethod>("DELIVERY");
  const [preparationHours, setPreparationHours] = useState("");
  const [useDiscount, setUseDiscount] = useState(false);
  const [discountPercent, setDiscountPercent] = useState("");
  const [maxPriceIncreasePercent, setMaxPriceIncreasePercent] = useState("");
  const [pausedProductIds, setPausedProductIds] = useState<Set<string>>(new Set());
  const [pausingProductId, setPausingProductId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [offerId, setOfferId] = useState<string | null>(id ?? null);
  const [isActive, setIsActive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const myProducts = await productService.getMyVendorProducts();
      setProducts(myProducts);

      if (id) {
        const offers = await regularDeliveriesService.listMyOffers();
        const existing = offers.find((o) => o.id === id);
        if (!existing) throw new Error("Offer not found");
        setTitle(existing.title);
        setDescription(existing.description ?? "");
        setSelectedProductIds(new Set(existing.products.map((p) => p.productId)));
        setPausedProductIds(new Set(existing.products.filter((p) => p.pausedAt).map((p) => p.productId)));
        setFrequencies(new Set(existing.frequencies));
        setSubstitutionPolicy(existing.substitutionPolicy ?? "");
        setSubstitutionMode(existing.substitutionMode ?? "ASK_BUYER");
        setRenewalCutoffHours(existing.renewalCutoffHours != null ? String(existing.renewalCutoffHours) : "");
        setFulfilmentMethod(existing.fulfilmentMethod ?? "DELIVERY");
        setPreparationHours(existing.preparationHours != null ? String(existing.preparationHours) : "");
        setUseDiscount(existing.discountPercent != null);
        setDiscountPercent(existing.discountPercent != null ? String(existing.discountPercent) : "");
        setMaxPriceIncreasePercent(existing.maxPriceIncreaseApprovalBps != null ? String(existing.maxPriceIncreaseApprovalBps / 100) : "");
        setIsActive(existing.isActive);
        setOfferId(existing.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this offer.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleProduct = (productId: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId); else next.add(productId);
      return next;
    });
  };

  const toggleFrequency = (f: SubscriptionFrequency) => {
    setFrequencies((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f); else next.add(f);
      return next;
    });
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Title required", "Give this offer a name.");
      return;
    }
    if (selectedProductIds.size === 0) {
      Alert.alert("Select products", "Choose at least one product for this offer.");
      return;
    }
    if (frequencies.size === 0) {
      Alert.alert("Select a frequency", "Choose at least one delivery frequency.");
      return;
    }
    const trimmedCutoff = renewalCutoffHours.trim();
    const parsedCutoff = trimmedCutoff ? Number(trimmedCutoff) : undefined;
    if (trimmedCutoff && (!Number.isFinite(parsedCutoff) || (parsedCutoff as number) <= 0)) {
      Alert.alert("Invalid cutoff", "Enter a valid number of hours, or leave it blank.");
      return;
    }
    const trimmedPrep = preparationHours.trim();
    const parsedPrep = trimmedPrep ? Number(trimmedPrep) : undefined;
    if (trimmedPrep && (!Number.isFinite(parsedPrep) || (parsedPrep as number) < 0)) {
      Alert.alert("Invalid preparation time", "Enter a valid number of hours, or leave it blank.");
      return;
    }
    let parsedDiscount: number | undefined;
    if (useDiscount) {
      const trimmedDiscount = discountPercent.trim();
      parsedDiscount = trimmedDiscount ? Number(trimmedDiscount) : undefined;
      if (!trimmedDiscount || !Number.isFinite(parsedDiscount) || (parsedDiscount as number) <= 0 || (parsedDiscount as number) > 90) {
        Alert.alert("Invalid discount", "Enter a discount percentage between 1 and 90.");
        return;
      }
    }
    const trimmedMaxIncrease = maxPriceIncreasePercent.trim();
    let parsedMaxIncreaseBps: number | undefined;
    if (trimmedMaxIncrease) {
      const pct = Number(trimmedMaxIncrease);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        Alert.alert("Invalid limit", "Enter a maximum price increase between 0 and 100%, or leave it blank.");
        return;
      }
      parsedMaxIncreaseBps = Math.round(pct * 100);
    }
    setSaving(true);
    try {
      const input = {
        title: title.trim(),
        description: description.trim() || undefined,
        productIds: Array.from(selectedProductIds),
        frequencies: Array.from(frequencies),
        substitutionPolicy: substitutionPolicy.trim() || undefined,
        substitutionMode,
        renewalCutoffHours: parsedCutoff,
        fulfilmentMethod,
        preparationHours: parsedPrep ?? (isEdit ? null : undefined),
        discountPercent: useDiscount ? parsedDiscount : (isEdit ? null : undefined),
        maxPriceIncreaseApprovalBps: parsedMaxIncreaseBps ?? (isEdit ? null : undefined),
      };
      const offer = offerId
        ? await regularDeliveriesService.updateOffer(offerId, input)
        : await regularDeliveriesService.createOffer(input);
      setOfferId(offer.id);
      setIsActive(offer.isActive);
      Alert.alert("Saved", isEdit ? "Offer updated." : "Offer created as a draft. Publish it when ready.");
      if (!isEdit) router.replace({ pathname: "/(vendor)/regular-delivery-offer-edit", params: { id: offer.id } } as any);
    } catch (err) {
      Alert.alert("Couldn't save offer", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePauseProduct = (productId: string, productName: string) => {
    if (!offerId) return;
    const isPaused = pausedProductIds.has(productId);
    if (isPaused) {
      void runProductPauseToggle(productId, () => regularDeliveriesService.resumeOfferProduct(offerId, productId));
      return;
    }
    Alert.alert(
      "Pause this product?",
      `${productName} won't be included in any subscriber's next renewal until you resume it. Affected buyers will be notified.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Pause product", style: "destructive", onPress: () => void runProductPauseToggle(productId, () => regularDeliveriesService.pauseOfferProduct(offerId, productId)) },
      ],
    );
  };

  const runProductPauseToggle = async (productId: string, action: () => Promise<unknown>) => {
    setPausingProductId(productId);
    try {
      await action();
      setPausedProductIds((prev) => {
        const next = new Set(prev);
        if (next.has(productId)) next.delete(productId); else next.add(productId);
        return next;
      });
    } catch (err) {
      Alert.alert("Couldn't update this product", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setPausingProductId(null);
    }
  };

  const handleTogglePublish = async () => {
    if (!offerId) return;
    setPublishing(true);
    try {
      const offer = isActive
        ? await regularDeliveriesService.unpublishOffer(offerId)
        : await regularDeliveriesService.publishOffer(offerId);
      setIsActive(offer.isActive);
    } catch (err) {
      Alert.alert("Couldn't update offer", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title={isEdit ? "Edit offer" : "New offer"} onBack={() => goBackOrReplace(router, "/(vendor)/regular-deliveries" as any)} />

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <View style={premiumStyles.block}><ErrorState message={error} onRetry={() => void load()} /></View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
          <View style={[premiumStyles.block, { gap: 14 }]}>
            <FloatingCard style={{ gap: 14 }}>
              <View>
                <Text style={styles.label}>Title</Text>
                <TextInput style={styles.input} placeholder="e.g. Monthly Staples Box" placeholderTextColor="#8AA194" value={title} onChangeText={setTitle} />
              </View>
              <View>
                <Text style={styles.label}>Description (optional)</Text>
                <TextInput style={[styles.input, styles.inputMultiline]} placeholder="Tell buyers what's included" placeholderTextColor="#8AA194" value={description} onChangeText={setDescription} multiline />
              </View>
              <View>
                <Text style={styles.label}>Frequencies offered</Text>
                <View style={styles.chipRow}>
                  {ALL_FREQUENCIES.map((f) => (
                    <TouchableOpacity key={f} onPress={() => toggleFrequency(f)} activeOpacity={0.85} style={[styles.chip, frequencies.has(f) && styles.chipActive]}>
                      <Text style={[styles.chipText, frequencies.has(f) && styles.chipTextActive]}>{FREQUENCY_LABELS[f]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </FloatingCard>

            <View>
              <Text style={styles.sectionTitle}>Pricing rules</Text>
              <FloatingCard style={{ gap: 14 }}>
                <TouchableOpacity onPress={() => setUseDiscount((v) => !v)} activeOpacity={0.85} style={styles.checkRow}>
                  <Ionicons name={useDiscount ? "checkbox" : "square-outline"} size={20} color={useDiscount ? "#076B51" : "#C7D2CB"} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.checkRowLabel}>Offer a Regular Delivery discount</Text>
                    <Text style={styles.fieldHint}>Off uses the current product price at each renewal.</Text>
                  </View>
                </TouchableOpacity>
                {useDiscount ? (
                  <View>
                    <Text style={styles.label}>Discount percentage</Text>
                    <TextInput style={styles.input} placeholder="e.g. 10" placeholderTextColor="#8AA194" value={discountPercent} onChangeText={setDiscountPercent} keyboardType="number-pad" />
                  </View>
                ) : null}
                <View>
                  <Text style={styles.label}>Maximum price increase without buyer approval (optional)</Text>
                  <TextInput style={styles.input} placeholder="e.g. 5" placeholderTextColor="#8AA194" value={maxPriceIncreasePercent} onChangeText={setMaxPriceIncreasePercent} keyboardType="number-pad" />
                  <Text style={styles.fieldHint}>Buyers must approve changes above this limit before payment. Leave blank to use Eki's default.</Text>
                </View>
              </FloatingCard>
            </View>

            <View>
              <Text style={styles.sectionTitle}>Fulfilment rules</Text>
              <FloatingCard style={{ gap: 14 }}>
                <View>
                  <Text style={styles.label}>Fulfilment method</Text>
                  <View style={styles.chipRow}>
                    {ALL_FULFILMENT_METHODS.map((m) => (
                      <TouchableOpacity key={m} onPress={() => setFulfilmentMethod(m)} activeOpacity={0.85} style={[styles.chip, fulfilmentMethod === m && styles.chipActive]}>
                        <Text style={[styles.chipText, fulfilmentMethod === m && styles.chipTextActive]}>{FULFILMENT_METHOD_LABELS[m]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View>
                  <Text style={styles.label}>Order preparation time, in hours (optional)</Text>
                  <TextInput style={styles.input} placeholder="e.g. 24" placeholderTextColor="#8AA194" value={preparationHours} onChangeText={setPreparationHours} keyboardType="number-pad" />
                </View>
                <View>
                  <Text style={styles.label}>Renewal cutoff, in hours (optional)</Text>
                  <TextInput style={styles.input} placeholder="e.g. 48" placeholderTextColor="#8AA194" value={renewalCutoffHours} onChangeText={setRenewalCutoffHours} keyboardType="number-pad" />
                  <Text style={styles.fieldHint}>How many hours before a renewal buyers can still pause, skip, or edit it.</Text>
                </View>
                <View>
                  <Text style={styles.label}>Substitution policy</Text>
                  <View style={styles.chipRowWrap}>
                    {ALL_SUBSTITUTION_MODES.map((mode) => (
                      <TouchableOpacity key={mode} onPress={() => setSubstitutionMode(mode)} activeOpacity={0.85} style={[styles.chip, substitutionMode === mode && styles.chipActive]}>
                        <Text style={[styles.chipText, substitutionMode === mode && styles.chipTextActive]}>{SUBSTITUTION_MODE_LABELS[mode]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                {substitutionMode === "ALLOW_SIMILAR" ? (
                  <View>
                    <Text style={styles.label}>Substitution details (optional)</Text>
                    <TextInput style={[styles.input, styles.inputMultiline]} placeholder="What happens if an item is out of stock?" placeholderTextColor="#8AA194" value={substitutionPolicy} onChangeText={setSubstitutionPolicy} multiline />
                  </View>
                ) : null}
              </FloatingCard>
            </View>

            <View>
              <Text style={styles.sectionTitle}>Eligible foodstuff</Text>
              {products.length === 0 ? (
                <FloatingCard>
                  <Text style={styles.emptyProductsText}>Add products to your store first, then come back to build this offer.</Text>
                </FloatingCard>
              ) : (
                <FloatingCard style={{ padding: 0, overflow: "hidden" }}>
                  {products.map((p, index) => {
                    const selected = selectedProductIds.has(p.id);
                    const isPaused = pausedProductIds.has(p.id);
                    return (
                      <View key={p.id} style={[styles.productRow, index > 0 && styles.productRowBorder]}>
                        <TouchableOpacity onPress={() => toggleProduct(p.id)} activeOpacity={0.85} style={styles.productRowTouchable}>
                          <Ionicons name={selected ? "checkbox" : "square-outline"} size={20} color={selected ? "#076B51" : "#C7D2CB"} />
                          <Text style={styles.productLabel} numberOfLines={1}>{p.name}</Text>
                          {isPaused ? <StatusPill label="Paused" tone="warning" /> : null}
                        </TouchableOpacity>
                        {offerId && selected ? (
                          <TouchableOpacity
                            onPress={() => handleTogglePauseProduct(p.id, p.name)}
                            disabled={pausingProductId === p.id}
                            activeOpacity={0.85}
                            style={styles.pauseProductBtn}
                          >
                            {pausingProductId === p.id ? (
                              <ActivityIndicator size="small" color="#076B51" />
                            ) : (
                              <Ionicons name={isPaused ? "play-outline" : "pause-outline"} size={16} color="#076B51" />
                            )}
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    );
                  })}
                </FloatingCard>
              )}
            </View>

            <PrimaryButton label={isEdit ? "Save changes" : "Create offer"} onPress={() => void handleSave()} loading={saving} />

            {offerId ? (
              <OutlineButton
                label={isActive ? "Unpublish" : "Publish this offer"}
                onPress={() => void handleTogglePublish()}
                loading={publishing}
              />
            ) : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#516A60", marginBottom: 8 },
  fieldHint: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#8AA194", marginTop: 6 },
  input: { backgroundColor: "#F4F6F5", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, fontFamily: "Outfit-Regular", color: "#151E1B" },
  inputMultiline: { minHeight: 70, textAlignVertical: "top" },
  sectionTitle: { fontSize: 15, fontFamily: "Manrope-ExtraBold", color: "#12221A", marginBottom: 10 },
  emptyProductsText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#6A7B72", lineHeight: 19 },
  productRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 16, paddingVertical: 13 },
  productRowTouchable: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  productRowBorder: { borderTopWidth: 1, borderTopColor: "#F0F0F0" },
  productLabel: { flex: 1, fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
  pauseProductBtn: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#F4F6F5", alignItems: "center", justifyContent: "center" },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkRowLabel: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chipRowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: "#F4F6F5" },
  chipActive: { backgroundColor: "#076B51" },
  chipText: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#516A60" },
  chipTextActive: { color: "#FFFFFF" },
});
