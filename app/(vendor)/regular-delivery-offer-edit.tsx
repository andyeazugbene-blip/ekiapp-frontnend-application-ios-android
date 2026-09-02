import React, { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
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
  premiumStyles,
} from "../../components/shared/PremiumBlocks";
import {
  regularDeliveriesService,
  FREQUENCY_LABELS,
  type SubscriptionFrequency,
} from "../../services/regularDeliveriesService";

const ALL_FREQUENCIES: SubscriptionFrequency[] = ["WEEKLY", "BIWEEKLY", "MONTHLY"];

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
        setFrequencies(new Set(existing.frequencies));
        setSubstitutionPolicy(existing.substitutionPolicy ?? "");
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
    setSaving(true);
    try {
      const input = {
        title: title.trim(),
        description: description.trim() || undefined,
        productIds: Array.from(selectedProductIds),
        frequencies: Array.from(frequencies),
        substitutionPolicy: substitutionPolicy.trim() || undefined,
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
              <View>
                <Text style={styles.label}>Substitution policy (optional)</Text>
                <TextInput style={[styles.input, styles.inputMultiline]} placeholder="What happens if an item is out of stock?" placeholderTextColor="#8AA194" value={substitutionPolicy} onChangeText={setSubstitutionPolicy} multiline />
              </View>
            </FloatingCard>

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
                    return (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => toggleProduct(p.id)}
                        activeOpacity={0.85}
                        style={[styles.productRow, index > 0 && styles.productRowBorder]}
                      >
                        <Ionicons name={selected ? "checkbox" : "square-outline"} size={20} color={selected ? "#076B51" : "#C7D2CB"} />
                        <Text style={styles.productLabel} numberOfLines={1}>{p.name}</Text>
                      </TouchableOpacity>
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
  input: { backgroundColor: "#F4F6F5", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, fontFamily: "Outfit-Regular", color: "#151E1B" },
  inputMultiline: { minHeight: 70, textAlignVertical: "top" },
  sectionTitle: { fontSize: 15, fontFamily: "Manrope-ExtraBold", color: "#12221A", marginBottom: 10 },
  emptyProductsText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#6A7B72", lineHeight: 19 },
  productRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  productRowBorder: { borderTopWidth: 1, borderTopColor: "#F0F0F0" },
  productLabel: { flex: 1, fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: "#F4F6F5" },
  chipActive: { backgroundColor: "#076B51" },
  chipText: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#516A60" },
  chipTextActive: { color: "#FFFFFF" },
});
