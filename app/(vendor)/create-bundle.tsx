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

export default function CreateBundleScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const vendor = user?.role === "vendor" ? user : null;
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bundlePrice, setBundlePrice] = useState("");
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

  const currency = products[0]?.currency ?? "GBP";
  const symbol = CURRENCY_SYMBOL[currency] ?? "£";
  const parsedPrice = Number(bundlePrice) || 0;

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

    setSubmitting(true);
    try {
      const created = await marketingService.createBundle({
        name: name.trim(),
        productIds: selectedIds,
        bundlePrice: parsedPrice,
        currency,
      });
      router.replace({
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
          {/* Card Modal matching Image 4 */}
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create Bundle</Text>

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
                <Text style={styles.submitButtonText}>Create Bundle</Text>
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
