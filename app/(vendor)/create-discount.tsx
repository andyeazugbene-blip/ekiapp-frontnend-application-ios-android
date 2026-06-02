import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../stores/authStore";
import { productService } from "../../services/productService";
import { marketingService } from "../../services/marketingService";
import { Product } from "../../types/product";

export default function CreateDiscountScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const vendor = user?.role === "vendor" ? user : null;
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productId, setProductId] = useState<string>("__all__");
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!vendor) { setLoadingProducts(false); return; }
    productService
      .getMyVendorProducts()
      .then((list) => setProducts(list ?? []))
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, [vendor]);

  const handleSubmit = async () => {
    setError("");
    if (!name.trim()) {
      setError("Please enter a discount name.");
      return;
    }
    const cleanValue = value.replace("%", "").trim();
    const numericValue = Number(cleanValue);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      setError("Please enter a valid discount percentage or amount.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await marketingService.createDiscount({
        productIds: productId === "__all__" ? [] : [productId],
        audience: "all",
        kind: value.includes("%") ? "percentage" : "fixed_amount",
        value: numericValue,
        startsAt: startDate || undefined,
        endsAt: endDate || undefined,
      });
      const selectedProduct = products.find((item) => item.id === productId);
      router.push({
        pathname: "/(vendor)/promo-link",
        params: {
          promo: created.code ?? name.trim(),
          url: created.shareUrl ?? undefined,
          productId: productId !== "__all__" ? productId : undefined,
          productName: selectedProduct?.name,
          campaignType: "discount",
        },
      } as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create discount.");
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
          {/* Card Modal matching Image 3 */}
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create Discount</Text>

            {/* Discount name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Discount name</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g summer special"
                  placeholderTextColor="#858585"
                  style={styles.input}
                />
              </View>
            </View>

            {/* Percentage or amount */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Percentage or amount</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  value={value}
                  onChangeText={setValue}
                  placeholder="e.g 10% or 5"
                  placeholderTextColor="#858585"
                  style={styles.input}
                />
              </View>
            </View>

            {/* Start date & End date row */}
            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>Start date</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="dd/mm/yy"
                    placeholderTextColor="#858585"
                    style={styles.input}
                  />
                  <Ionicons name="calendar-outline" size={16} color="#858585" style={styles.inputIcon} />
                </View>
              </View>
              <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.fieldLabel}>End date</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="dd/mm/yy"
                    placeholderTextColor="#858585"
                    style={styles.input}
                  />
                  <Ionicons name="calendar-outline" size={16} color="#858585" style={styles.inputIcon} />
                </View>
              </View>
            </View>

            {/* Foodstuff to apply to */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Foodstuff to apply to</Text>
              <View style={styles.inputWrap}>
                {loadingProducts ? (
                  <ActivityIndicator color="#076B51" style={{ alignSelf: "flex-start", marginLeft: 15 }} />
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dropdownRow}>
                    <TouchableOpacity
                      onPress={() => setProductId("__all__")}
                      style={[styles.dropdownChip, productId === "__all__" && styles.dropdownChipActive]}
                    >
                      <Text style={[styles.dropdownChipText, productId === "__all__" && styles.dropdownChipTextActive]}>All Foodstuff</Text>
                    </TouchableOpacity>
                    {products.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => setProductId(p.id)}
                        style={[styles.dropdownChip, productId === p.id && styles.dropdownChipActive]}
                      >
                        <Text style={[styles.dropdownChipText, productId === p.id && styles.dropdownChipTextActive]}>{p.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                <Ionicons name="time-outline" size={16} color="#858585" style={styles.inputIcon} />
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
                <Text style={styles.submitButtonText}>Create Discount</Text>
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
    right: 16 
  },
  row: { 
    flexDirection: "row", 
    width: "100%" 
  },
  dropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 24
  },
  dropdownChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#EAEAEA"
  },
  dropdownChipActive: {
    backgroundColor: "#076B51"
  },
  dropdownChipText: {
    fontSize: 12,
    fontFamily: "Outfit-Medium",
    color: "#858585"
  },
  dropdownChipTextActive: {
    color: "#FFFFFF"
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
