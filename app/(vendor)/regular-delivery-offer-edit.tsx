import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { productService } from "../../services/productService";
import { Product } from "../../types/product";
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
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)/regular-deliveries" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? "Edit offer" : "New offer"}</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.placeholder}><ActivityIndicator color="#076B51" /></View>
      ) : error ? (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={28} color="#D6552F" />
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity onPress={() => void load()} activeOpacity={0.86} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.label}>Title</Text>
          <TextInput style={styles.input} placeholder="e.g. Monthly Staples Box" placeholderTextColor="#9AA3A0" value={title} onChangeText={setTitle} />

          <Text style={styles.label}>Description (optional)</Text>
          <TextInput style={[styles.input, styles.inputMultiline]} placeholder="Tell buyers what's included" placeholderTextColor="#9AA3A0" value={description} onChangeText={setDescription} multiline />

          <Text style={styles.label}>Eligible foodstuff</Text>
          {products.length === 0 ? (
            <Text style={styles.emptyProductsText}>Add products to your store first, then come back to build this offer.</Text>
          ) : (
            products.map((p) => {
              const selected = selectedProductIds.has(p.id);
              return (
                <TouchableOpacity key={p.id} onPress={() => toggleProduct(p.id)} activeOpacity={0.85} style={[styles.productRow, selected && styles.productRowActive]}>
                  <Ionicons name={selected ? "checkbox" : "square-outline"} size={20} color={selected ? "#076B51" : "#9AA3A0"} />
                  <Text style={styles.productLabel} numberOfLines={1}>{p.name}</Text>
                </TouchableOpacity>
              );
            })
          )}

          <Text style={styles.label}>Frequencies offered</Text>
          <View style={styles.chipRow}>
            {ALL_FREQUENCIES.map((f) => (
              <TouchableOpacity key={f} onPress={() => toggleFrequency(f)} activeOpacity={0.85} style={[styles.chip, frequencies.has(f) && styles.chipActive]}>
                <Text style={[styles.chipText, frequencies.has(f) && styles.chipTextActive]}>{FREQUENCY_LABELS[f]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Substitution policy (optional)</Text>
          <TextInput style={[styles.input, styles.inputMultiline]} placeholder="What happens if an item is out of stock?" placeholderTextColor="#9AA3A0" value={substitutionPolicy} onChangeText={setSubstitutionPolicy} multiline />

          <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.88} style={[styles.primaryBtn, saving && { opacity: 0.7 }]}>
            {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>{isEdit ? "Save changes" : "Create offer"}</Text>}
          </TouchableOpacity>

          {offerId ? (
            <TouchableOpacity onPress={handleTogglePublish} disabled={publishing} activeOpacity={0.85} style={styles.secondaryBtn}>
              {publishing ? <ActivityIndicator size="small" color="#076B51" /> : (
                <Text style={styles.secondaryBtnText}>{isActive ? "Unpublish" : "Publish this offer"}</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },
  header: { backgroundColor: "#FFFFFF", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Manrope-Bold", color: "#282828" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 8 },
  emptyText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center" },
  emptyProductsText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", paddingVertical: 8 },
  retryButton: { marginTop: 10, minHeight: 38, borderRadius: 12, borderWidth: 1, borderColor: "#076B51", paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  retryButtonText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100, gap: 8 },
  label: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#282828", marginTop: 10 },
  input: { backgroundColor: "#FFFFFF", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828" },
  inputMultiline: { minHeight: 70, textAlignVertical: "top" },
  productRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFFFFF", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "transparent" },
  productRowActive: { borderColor: "#076B51" },
  productLabel: { flex: 1, fontSize: 13, fontFamily: "Outfit-Medium", color: "#282828" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DADADA" },
  chipActive: { backgroundColor: "#076B51", borderColor: "#076B51" },
  chipText: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#282828" },
  chipTextActive: { color: "#FFFFFF" },
  primaryBtn: { minHeight: 52, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", marginTop: 16 },
  primaryBtnText: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  secondaryBtn: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: "#076B51", alignItems: "center", justifyContent: "center", marginTop: 10 },
  secondaryBtnText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
});
