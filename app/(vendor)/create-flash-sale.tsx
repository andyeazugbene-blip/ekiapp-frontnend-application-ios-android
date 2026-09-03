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

export default function CreateFlashSaleScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const vendor = user?.role === "vendor" ? user : null;
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
  const [discountValue, setDiscountValue] = useState("");
  const [duration, setDuration] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"form" | "review">("form");
  const [reviewSalePrice, setReviewSalePrice] = useState(0);
  const [reviewEnds, setReviewEnds] = useState<Date | null>(null);

  useEffect(() => {
    if (!vendor) { setLoadingProducts(false); return; }
    productService
      .getMyVendorProducts()
      .then((list) => {
        const safeList = list ?? [];
        setProducts(safeList);
        if (safeList.length > 0) setProductId(safeList[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, [vendor]);

  const selectedProduct = products.find((p) => p.id === productId) ?? null;
  const symbol = CURRENCY_SYMBOL[selectedProduct?.currency ?? "GBP"] ?? "£";

  const handleSubmit = async () => {
    setError("");
    if (!productId) {
      setError("Please pick a product to discount.");
      return;
    }
    const cleanDiscount = discountValue.replace("%", "").trim();
    const numericDiscount = Number(cleanDiscount);
    if (!Number.isFinite(numericDiscount) || numericDiscount <= 0 || numericDiscount >= 100) {
      setError("Please enter a valid discount percentage (e.g. 5 or 5%).");
      return;
    }
    const durationHours = Number(duration.replace(/[^0-9.]/g, ""));
    if (!duration.trim() || !Number.isFinite(durationHours) || durationHours <= 0) {
      setError("Please enter a valid duration in hours (e.g. 24).");
      return;
    }

    const calculatedSalePrice = selectedProduct
      ? selectedProduct.price * (1 - numericDiscount / 100)
      : 0;

    const now = new Date();
    const ends = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

    setReviewSalePrice(calculatedSalePrice);
    setReviewEnds(ends);
    setStep("review");
  };

  const submitFlashSale = async () => {
    if (!productId || !reviewEnds) return;
    setSubmitting(true);
    try {
      const now = new Date();
      const created = await marketingService.createFlashSale({
        productId,
        salePrice: parseFloat(reviewSalePrice.toFixed(2)),
        currency: selectedProduct?.currency ?? "GBP",
        startsAt: now.toISOString(),
        endsAt: reviewEnds.toISOString(),
      });
      router.push({
        pathname: "/(vendor)/promo-link",
        params: {
          url: created.shareUrl,
          productId,
          productName: selectedProduct?.name,
          campaignType: "flash-sale",
        },
      } as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start flash sale.");
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
          {step === "review" && reviewEnds ? (
            <View style={styles.modalCard}>
              <View style={styles.modalHeaderRow}>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#076B51" />
                </View>
                <Text style={styles.modalTitle}>Review your flash sale</Text>
                <TouchableOpacity
                  onPress={() => goBackOrReplace(router, "/(vendor)/grow-sales" as any)}
                  activeOpacity={0.85}
                  style={styles.closeIconButton}
                >
                  <Ionicons name="close" size={18} color="#858585" />
                </TouchableOpacity>
              </View>
              <Text style={styles.reviewCaption}>Buyers will see how long the offer remains available.</Text>

              <View style={styles.reviewCard}>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Product</Text>
                  <Text style={styles.reviewValue}>{selectedProduct?.name ?? "Product"}</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Sale price</Text>
                  <Text style={styles.reviewValue}>{symbol}{reviewSalePrice.toFixed(2)}</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Ends</Text>
                  <Text style={styles.reviewValue}>{reviewEnds.toLocaleString()}</Text>
                </View>
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                onPress={() => void submitFlashSale()}
                style={[styles.submitButton, submitting && { opacity: 0.6 }]}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>Publish flash sale</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setStep("form")} disabled={submitting} style={styles.editButton}>
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
          ) : (
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalIconWrap}>
                <Ionicons name="flash-outline" size={20} color="#076B51" />
              </View>
              <Text style={styles.modalTitle}>Create Flash Sale</Text>
              <TouchableOpacity
                onPress={() => goBackOrReplace(router, "/(vendor)/grow-sales" as any)}
                activeOpacity={0.85}
                style={styles.closeIconButton}
              >
                <Ionicons name="close" size={18} color="#858585" />
              </TouchableOpacity>
            </View>

            {/* Foodstuff selection */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Foodstuff</Text>
              <View style={[styles.inputWrap, { height: "auto", minHeight: 50, paddingVertical: 8 }]}>
                {loadingProducts ? (
                  <ActivityIndicator color="#076B51" style={{ alignSelf: "flex-start", marginLeft: 8 }} />
                ) : (
                  <View style={styles.dropdownColumn}>
                    {products.map((p) => {
                      const selected = productId === p.id;
                      return (
                        <TouchableOpacity
                          key={p.id}
                          onPress={() => setProductId(p.id)}
                          activeOpacity={0.8}
                          style={[styles.dropdownRowItem, selected && styles.dropdownRowItemActive]}
                        >
                          <Ionicons 
                            name={selected ? "radio-button-on" : "radio-button-off"} 
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

            {/* Discount Percentage */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Discount</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  value={discountValue}
                  onChangeText={setDiscountValue}
                  placeholder="e.g 5%"
                  placeholderTextColor="#858585"
                  style={styles.input}
                />
              </View>
            </View>

            {/* Duration */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Duration</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  value={duration}
                  onChangeText={setDuration}
                  placeholder="e.g 2 hours"
                  placeholderTextColor="#858585"
                  style={styles.input}
                />
                <Ionicons name="calendar-outline" size={16} color="#858585" style={styles.inputIcon} />
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              style={[styles.submitButton, submitting && { opacity: 0.6 }]}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Review flash sale</Text>
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
