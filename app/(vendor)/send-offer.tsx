import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { buyerService, type VendorBuyerSummary } from "../../services/buyerService";
import { marketingService, type OfferAudience } from "../../services/marketingService";
import { productService } from "../../services/productService";
import type { Product } from "../../types/product";
import { goBackOrReplace } from "../../utils/navigation";

const AUDIENCES: { id: OfferAudience; label: string; helper: string }[] = [
  { id: "all_buyers", label: "All buyers", helper: "Every buyer with order history in your store." },
  { id: "last_30_days", label: "Last 30 days buyers", helper: "Buyers with recent paid orders from your store." },
  { id: "repeat_buyers", label: "Repeat Buyers", helper: "Buyers with two or more orders." },
  { id: "inactive_buyers", label: "Inactive Buyers", helper: "Buyers without an order in the last 30 days." },
  { id: "bought_specific_product", label: "Bought Specific Product", helper: "Buyers who ordered the selected product." },
  { id: "first_time_buyers", label: "First-Time Buyers", helper: "Buyers with exactly one order." },
  { id: "top_customers", label: "Top Customers", helper: "Highest-spending buyers from your real order history." },
  { id: "specific_buyer", label: "Specific buyer", helper: "Send to one selected buyer only." },
];

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default function SendOfferScreen() {
  const router = useRouter();
  const { buyerId: paramBuyerId } = useLocalSearchParams<{ buyerId?: string }>();

  const [audience, setAudience] = useState<OfferAudience>(paramBuyerId ? "specific_buyer" : "all_buyers");
  const [buyers, setBuyers] = useState<VendorBuyerSummary[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingBuyers, setLoadingBuyers] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | undefined>(paramBuyerId);
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    buyerService
      .listMyBuyers()
      .then((list) => setBuyers(list ?? []))
      .catch(() => {})
      .finally(() => setLoadingBuyers(false));
  }, []);

  useEffect(() => {
    productService
      .getMyVendorProducts()
      .then((list) => setProducts((list ?? []).filter((product) => product.status !== "out_of_stock")))
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, []);

  useEffect(() => {
    if (audience === "specific_buyer" && !selectedBuyerId && buyers.length > 0) {
      setSelectedBuyerId(buyers[0].id);
    }
  }, [audience, buyers, selectedBuyerId]);

  const selectedBuyer = useMemo(
    () => buyers.find((b) => b.id === selectedBuyerId) ?? null,
    [buyers, selectedBuyerId]
  );

  const selectedAudience = useMemo(
    () => AUDIENCES.find((option) => option.id === audience) ?? AUDIENCES[0],
    [audience],
  );

  const estimatedRecipients = useMemo(() => {
    if (audience === "all_buyers") return buyers.length;
    if (audience === "last_30_days") {
      const cutoff = Date.now() - THIRTY_DAYS_MS;
      return buyers.filter((buyer) => buyer.lastOrderAt && Date.parse(buyer.lastOrderAt) >= cutoff).length;
    }
    if (audience === "repeat_buyers") return buyers.filter((buyer) => buyer.totalOrders >= 2).length;
    if (audience === "inactive_buyers") {
      const cutoff = Date.now() - THIRTY_DAYS_MS;
      return buyers.filter((buyer) => !buyer.lastOrderAt || Date.parse(buyer.lastOrderAt) < cutoff).length;
    }
    if (audience === "first_time_buyers") return buyers.filter((buyer) => buyer.totalOrders === 1).length;
    if (audience === "top_customers") {
      const activeBuyerCount = buyers.filter((buyer) => buyer.totalSpent > 0 || buyer.totalOrders > 0).length;
      return Math.max(0, Math.min(25, Math.ceil(activeBuyerCount * 0.2)));
    }
    if (audience === "specific_buyer") return selectedBuyerId ? 1 : 0;
    return null;
  }, [audience, buyers, selectedBuyerId]);

  const handleSend = async () => {
    setError("");
    if (!message.trim()) {
      setError("Please write your offer message.");
      return;
    }
    if (audience === "specific_buyer" && !selectedBuyerId) {
      setError("Please pick a buyer for this offer.");
      return;
    }
    if (audience === "bought_specific_product" && !selectedProductId) {
      setError("Please pick the product these buyers purchased.");
      return;
    }

    setSubmitting(true);
    try {
      await marketingService.sendOffer({
        audience,
        buyerId: audience === "specific_buyer" ? selectedBuyerId : undefined,
        productId: audience === "bought_specific_product" ? selectedProductId : undefined,
        message: message.trim(),
      });
      goBackOrReplace(router, "/(vendor)/buyers" as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send offer.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.page}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)/buyers" as any)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Send Offer</Text>
          <Text style={styles.headerSubtitle}>Select buyers and send a private offer message through chat.</Text>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Audience</Text>
          <View style={styles.chipRow}>
            {AUDIENCES.map((option) => (
              <TouchableOpacity
                key={option.id}
                onPress={() => setAudience(option.id)}
                style={[styles.chip, audience === option.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, audience === option.id && styles.chipTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.helperText}>
            {selectedAudience.helper}
            {estimatedRecipients === null ? "" : ` Estimated recipients: ${estimatedRecipients}.`}
          </Text>
        </View>

        {audience === "bought_specific_product" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Pick a product</Text>
            {loadingProducts ? (
              <ActivityIndicator color="#076B51" />
            ) : products.length === 0 ? (
              <Text style={styles.helperText}>No products found yet. Add products before targeting product buyers.</Text>
            ) : (
              products.map((product) => {
                const selected = selectedProductId === product.id;
                return (
                  <TouchableOpacity
                    key={product.id}
                    onPress={() => setSelectedProductId(product.id)}
                    style={[styles.buyerItem, selected && styles.buyerItemActive]}
                  >
                    <Text style={[styles.buyerName, selected && styles.buyerNameActive]} numberOfLines={1}>{product.name}</Text>
                    <Text style={[styles.buyerEmail, selected && styles.buyerEmailActive]} numberOfLines={1}>
                      {product.currency} {product.price.toLocaleString()} · {product.stock} in stock
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
            <Text style={styles.helperText}>Matching buyers are verified from live order history before messages are sent.</Text>
          </View>
        )}

        {audience === "specific_buyer" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Pick a buyer</Text>
            {loadingBuyers ? (
              <ActivityIndicator color="#076B51" />
            ) : buyers.length === 0 ? (
              <Text style={styles.helperText}>No buyers yet — once orders come in, your buyers will appear here.</Text>
            ) : (
              buyers.map((buyer) => {
                const selected = selectedBuyerId === buyer.id;
                return (
                  <TouchableOpacity
                    key={buyer.id}
                    onPress={() => setSelectedBuyerId(buyer.id)}
                    style={[styles.buyerItem, selected && styles.buyerItemActive]}
                  >
                    <Text style={[styles.buyerName, selected && styles.buyerNameActive]} numberOfLines={1}>{buyer.name}</Text>
                    {buyer.email ? (
                      <Text style={[styles.buyerEmail, selected && styles.buyerEmailActive]} numberOfLines={1}>{buyer.email}</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })
            )}
            {selectedBuyer ? (
              <Text style={styles.helperText}>This offer will go to {selectedBuyer.name} only.</Text>
            ) : null}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Offer details</Text>
          <Text style={styles.fieldLabel}>Offer message</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={5}
            placeholder="Share the offer details, foodstuff selection, and expiry."
            placeholderTextColor="#858585"
            textAlignVertical="top"
            style={styles.textArea}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <TouchableOpacity onPress={handleSend} style={[styles.primaryButton, submitting && { opacity: 0.6 }]} disabled={submitting}>
          <Text style={styles.primaryButtonText}>{submitting ? "Sending..." : "Send Offer"}</Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F4F4F4" },
  headerSafeArea: { backgroundColor: "#076B51" },
  header: { backgroundColor: "#076B51", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, borderBottomLeftRadius: 35, borderBottomRightRadius: 35 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  headerTitle: { fontSize: 30, fontFamily: "Manrope-Bold", lineHeight: 30, color: "#FFFFFF" },
  headerSubtitle: { fontSize: 16, fontFamily: "Outfit-Light", color: "#FFFFFF", marginTop: 6 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 30, padding: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#858585", marginBottom: 6 },
  helperText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 20, backgroundColor: "#F4F4F4", paddingHorizontal: 14, paddingVertical: 10 },
  chipActive: { backgroundColor: "#076B51" },
  chipText: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#282828" },
  chipTextActive: { color: "#FFFFFF" },
  buyerItem: { backgroundColor: "#F4F4F4", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10 },
  buyerItemActive: { backgroundColor: "#076B51" },
  buyerName: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  buyerNameActive: { color: "#FFFFFF" },
  buyerEmail: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 4 },
  buyerEmailActive: { color: "rgba(255,255,255,0.7)" },
  textArea: { backgroundColor: "#F4F4F4", borderRadius: 10, minHeight: 120, paddingHorizontal: 15, paddingVertical: 14, fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828" },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", marginTop: 8 },
  primaryButton: { height: 56, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  primaryButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
});
