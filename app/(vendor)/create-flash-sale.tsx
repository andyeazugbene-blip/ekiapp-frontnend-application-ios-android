import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../stores/authStore";
import { productService } from "../../services/productService";
import { marketingService } from "../../services/marketingService";
import { Product } from "../../types/product";

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
    if (!duration.trim()) {
      setError("Please enter a duration.");
      return;
    }

    const calculatedSalePrice = selectedProduct 
      ? selectedProduct.price * (1 - numericDiscount / 100) 
      : 0;

    // Estimate start/end dates based on duration
    const now = new Date();
    const ends = new Date(now.getTime() + 2 * 60 * 60 * 1000); // Default to 2 hours if not parsed

    setSubmitting(true);
    try {
      const created = await marketingService.createFlashSale({
        productId,
        salePrice: parseFloat(calculatedSalePrice.toFixed(2)),
        currency: selectedProduct?.currency ?? "GBP",
        startsAt: now.toISOString(),
        endsAt: ends.toISOString(),
      });
      router.replace({
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
          {/* Card Modal matching Image 5 */}
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create Flash Sale</Text>

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
                <Text style={styles.submitButtonText}>Launch Flash Sale</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Centered Close Button below card matching mockup */}
          <TouchableOpacity 
            onPress={() => router.back()} 
            activeOpacity={0.85} 
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color="#282828" />
          </TouchableOpacity>
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
    borderRadius: 24, 
    padding: 24, 
    width: "100%", 
    maxWidth: 350,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8
  },
  modalTitle: { 
    fontSize: 18, 
    fontFamily: "Manrope-Bold", 
    color: "#282828", 
    textAlign: "center", 
    marginBottom: 20 
  },
  fieldGroup: { 
    marginBottom: 16,
    width: "100%"
  },
  fieldLabel: { 
    fontSize: 13, 
    fontFamily: "Outfit-Medium", 
    color: "#858585", 
    marginBottom: 8 
  },
  inputWrap: { 
    flexDirection: "row", 
    alignItems: "center", 
    backgroundColor: "#F4F4F4", 
    borderRadius: 12, 
    height: 50, 
    paddingHorizontal: 16,
    position: "relative"
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#EAEAEA"
  },
  dropdownRowItemActive: {
    backgroundColor: "#076B51"
  },
  dropdownRowText: {
    fontSize: 12,
    fontFamily: "Outfit-Medium",
    color: "#282828"
  },
  submitButton: { 
    height: 52, 
    borderRadius: 14, 
    backgroundColor: "#076B51", 
    alignItems: "center", 
    justifyContent: "center", 
    marginTop: 10,
    width: "100%" 
  },
  submitButtonText: { 
    fontSize: 15, 
    fontFamily: "Manrope-SemiBold", 
    color: "#FFFFFF" 
  },
  errorText: { 
    fontSize: 12, 
    fontFamily: "Outfit-Regular", 
    color: "#FB6363", 
    textAlign: "center", 
    marginBottom: 12 
  },
  closeButton: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    backgroundColor: "#FFFFFF", 
    alignItems: "center", 
    justifyContent: "center", 
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3
  }
});
