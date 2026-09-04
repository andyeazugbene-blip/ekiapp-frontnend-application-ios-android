import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../stores/authStore";
import { productService } from "../../services/productService";
import { marketingService } from "../../services/marketingService";
import { Product } from "../../types/product";
import { goBackOrReplace } from "../../utils/navigation";

const CURRENCY_SYMBOL: Record<string, string> = { GBP: "£", USD: "$", EUR: "€" };

export default function CreateBundleScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const vendor = user?.role === "vendor" ? user : null;
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bundlePrice, setBundlePrice] = useState("");
  const [quantityAvailable, setQuantityAvailable] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"form" | "review">("form");

  useEffect(() => {
    if (!vendor) { setLoadingProducts(false); return; }
    productService
      .getMyVendorProducts()
      .then((list) => setProducts(list ?? []))
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, [vendor]);

  const currency = products[0]?.currency ?? "GBP";
  const symbol = CURRENCY_SYMBOL[currency] ?? "£";
  const parsedPrice = Number(bundlePrice) || 0;
  const parsedQuantity = Math.round(Number(quantityAvailable));
  const regularTotal = products.filter((p) => selectedIds.includes(p.id)).reduce((sum, p) => sum + p.price, 0);
  const buyerSaving = Math.max(0, regularTotal - parsedPrice);

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handlePublish = async () => {
    setError("");
    if (!name.trim()) {
      setError("Please enter a bundle name.");
      return;
    }
    if (selectedIds.length < 2) {
      setError("Please select at least two foodstuff items.");
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError("Please enter a valid bundle price.");
      return;
    }
    if (quantityAvailable.trim() && (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0)) {
      setError("Quantity available must be a whole number greater than 0, or left blank for unlimited.");
      return;
    }

    setStep("review");
  };

  const submitBundle = async () => {
    setSubmitting(true);
    try {
      const created = await marketingService.createBundle({
        name: name.trim(),
        productIds: selectedIds,
        bundlePrice: parsedPrice,
        currency,
        quantityAvailable: quantityAvailable.trim() ? parsedQuantity : null,
      });
      router.push({
        pathname: "/(vendor)/promo-link",
        params: {
          promo: name.trim(),
          url: created.shareUrl,
          campaignType: "bundle",
        },
      } as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create bundle.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.scrim}>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {step === "review" ? (
            <View style={styles.modalCard}>
              <View style={styles.modalHeaderRow}>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#076B51" />
                </View>
                <Text style={styles.modalTitle}>Review your bundle</Text>
                <TouchableOpacity
                  onPress={() => goBackOrReplace(router, "/(vendor)/grow-sales" as any)}
                  activeOpacity={0.85}
                  style={styles.closeIconButton}
                >
                  <Ionicons name="close" size={18} color="#858585" />
                </TouchableOpacity>
              </View>
              <Text style={styles.reviewCaption}>Check the details before making this bundle available.</Text>

              <View style={styles.reviewCard}>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Bundle</Text>
                  <Text style={styles.reviewValue}>{name.trim()}</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Regular total</Text>
                  <Text style={styles.reviewValue}>{symbol}{regularTotal.toFixed(2)}</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Bundle price</Text>
                  <Text style={styles.reviewValue}>{symbol}{parsedPrice.toFixed(2)}</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Buyer saving</Text>
                  <Text style={styles.reviewValue}>{symbol}{buyerSaving.toFixed(2)}</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Quantity available</Text>
                  <Text style={styles.reviewValue}>{quantityAvailable.trim() ? parsedQuantity : "Unlimited"}</Text>
                </View>
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                onPress={() => void submitBundle()}
                style={[styles.submitButton, submitting && { opacity: 0.6 }]}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>Publish bundle</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setStep("form")} disabled={submitting} style={styles.editButton}>
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
          ) : (
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalIconWrap}>
                <Ionicons name="cube-outline" size={20} color="#076B51" />
              </View>
              <Text style={styles.modalTitle}>Create Bundle</Text>
              <TouchableOpacity
                onPress={() => goBackOrReplace(router, "/(vendor)/grow-sales" as any)}
                activeOpacity={0.85}
                style={styles.closeIconButton}
              >
                <Ionicons name="close" size={18} color="#858585" />
              </TouchableOpacity>
            </View>

            {/* Bundle name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Bundle name</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g family feast"
                  placeholderTextColor="#858585"
                  style={styles.input}
                />
              </View>
            </View>

            {/* Foodstuff Included */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Foodstuff Included</Text>
              <View style={[styles.inputWrap, { height: "auto", minHeight: 50, paddingVertical: 8 }]}>
                {loadingProducts ? (
                  <ActivityIndicator color="#076B51" style={{ alignSelf: "flex-start", marginLeft: 8 }} />
                ) : (
                  <View style={styles.dropdownColumn}>
                    {products.map((p) => {
                      const selected = selectedIds.includes(p.id);
                      return (
                        <TouchableOpacity
                          key={p.id}
                          onPress={() => toggle(p.id)}
                          activeOpacity={0.8}
                          style={[styles.dropdownRowItem, selected && styles.dropdownRowItemActive]}
                        >
                          <Ionicons 
                            name={selected ? "checkbox" : "square-outline"} 
                            size={16} 
                            color={selected ? "#FFFFFF" : "#858585"} 
                          />
                          <Text style={[styles.dropdownRowText, selected && { color: "#FFFFFF" }]}>
                            {p.name} ({symbol}{p.price.toFixed(2)})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    {products.length === 0 && (
                      <Text style={{ fontSize: 13, color: "#858585", fontFamily: "Outfit-Regular" }}>
                        No products available.
                      </Text>
                    )}
                  </View>
                )}
                <Ionicons name="chevron-down" size={16} color="#858585" style={styles.inputIcon} />
              </View>
            </View>

            {/* Bundle price */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Bundle price</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  value={bundlePrice}
                  onChangeText={setBundlePrice}
                  placeholder="e.g £ 5.00"
                  placeholderTextColor="#858585"
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </View>
            </View>

            {/* Bundle quantity available */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Bundle quantity available (optional)</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  value={quantityAvailable}
                  onChangeText={setQuantityAvailable}
                  placeholder="Leave blank for unlimited"
                  placeholderTextColor="#858585"
                  keyboardType="number-pad"
                  style={styles.input}
                />
              </View>
            </View>

            {selectedIds.length > 0 ? (
              <View style={styles.savingRow}>
                <Text style={styles.savingLabel}>Regular total: {symbol}{regularTotal.toFixed(2)}</Text>
                <Text style={styles.savingValue}>Buyer saves {symbol}{buyerSaving.toFixed(2)}</Text>
              </View>
            ) : null}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handlePublish}
              style={[styles.submitButton, submitting && { opacity: 0.6 }]}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Review bundle</Text>
              )}
            </TouchableOpacity>
          </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { 
    flex: 1, 
    backgroundColor: "rgba(11,78,60,0.88)" 
  },
  container: { 
    flex: 1 
  },
  scrollContent: { 
    flexGrow: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    padding: 20 
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 22,
    width: "100%",
    maxWidth: 380,
    shadowColor: "#0B2A21",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 10,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 22,
  },
  modalIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "rgba(7,107,81,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F4F4F4",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: "Manrope-Bold",
    color: "#151E1B",
  },
  fieldGroup: {
    marginBottom: 16,
    width: "100%"
  },
  savingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(7,107,81,0.08)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 16,
  },
  savingLabel: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#516A60" },
  savingValue: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#076B51" },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Manrope-SemiBold",
    color: "#516A60",
    marginBottom: 8
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F4F6F5",
    borderRadius: 16,
    height: 52,
    paddingHorizontal: 16,
    position: "relative",
  },
  input: { 
    flex: 1, 
    height: "100%", 
    fontSize: 14, 
    fontFamily: "Outfit-Regular", 
    color: "#282828" 
  },
  inputIcon: { 
    position: "absolute", 
    right: 16,
    top: 17
  },
  dropdownColumn: {
    flex: 1,
    flexDirection: "column",
    gap: 6,
    paddingRight: 24
  },
  dropdownRowItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#EEF3F0"
  },
  dropdownRowItemActive: {
    backgroundColor: "#076B51"
  },
  dropdownRowText: {
    fontSize: 12,
    fontFamily: "Manrope-SemiBold",
    color: "#516A60"
  },
  submitButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    width: "100%",
    shadowColor: "#076B51",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 4,
  },
  submitButtonText: {
    fontSize: 15,
    fontFamily: "Manrope-Bold",
    color: "#FFFFFF"
  },
  errorText: {
    fontSize: 12,
    fontFamily: "Outfit-Regular",
    color: "#D6552F",
    backgroundColor: "rgba(214,85,47,0.1)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    textAlign: "center",
    marginBottom: 12
  },
  reviewCaption: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#6A7B72", marginTop: -14, marginBottom: 16, lineHeight: 19 },
  reviewCard: { backgroundColor: "#F4F6F5", borderRadius: 18, padding: 16, gap: 12, marginBottom: 16 },
  reviewRow: { gap: 2 },
  reviewLabel: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#8AA194" },
  reviewValue: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#151E1B" },
  editButton: { height: 46, alignItems: "center", justifyContent: "center", marginTop: 8 },
  editButtonText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#516A60" },
});
