import React, { useCallback } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { TAB_BAR_RESERVED_SPACE } from "../../components/layout/tabBarConstants";
import { useCartStore } from "../../stores/cartStore";
import { useCurrencyStore } from "../../stores/currencyStore";
import { CurrencySelector } from "../../components/ui/CurrencySelector";
import { formatDisplayMoney } from "../../utils/currency";
import { goBackOrReplace } from "../../utils/navigation";

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const items = useCartStore((state) => state.items);
  const groupedByVendor = useCartStore((state) => state.groupedByVendor());
  const vendorCount = useCartStore((state) => state.vendorCount());
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const subtotal = useCartStore((state) => state.subtotal());
  const totalItems = useCartStore((state) => state.totalItems());
  const deliveryTotal = useCartStore((state) => state.deliveryTotal());
  const grandTotal = useCartStore((state) => state.grandTotal());
  const isLoading = useCartStore((state) => state.isLoading);
  const calculateDelivery = useCartStore((state) => state.calculateDelivery);
  const deliveryCountry = useCartStore((state) => state.deliveryCountry);
  const syncWithServer = useCartStore((state) => state.syncWithServer);
  const selectedCurrency = useCurrencyStore((state) => state.selectedCurrency);
  const ensureCurrency = useCurrencyStore((state) => state.ensureCurrency);
  const setSelectedCurrency = useCurrencyStore((state) => state.setSelectedCurrency);
  const [currencyOpen, setCurrencyOpen] = React.useState(false);

  useFocusEffect(
    useCallback(() => {
      syncWithServer();
      if (items.length > 0) {
        calculateDelivery(deliveryCountry).catch(() => {});
      }
    }, [calculateDelivery, deliveryCountry, items.length, syncWithServer]),
  );

  const totalWeight = items.reduce((sum, item) => sum + (item.product.weight ?? 0) * item.quantity, 0);
  const checkoutCurrency = items[0]?.product.currency ?? "GBP";

  React.useEffect(() => {
    ensureCurrency(checkoutCurrency).catch(() => undefined);
  }, [checkoutCurrency, ensureCurrency]);

  const handleQuantityChange = (productId: string, quantity: number) => {
    updateQuantity(productId, quantity).catch((err) => {
      Alert.alert("Cart not updated", err instanceof Error ? err.message : "Could not update this item.");
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)" as any)} activeOpacity={0.85} accessibilityLabel="Go back" accessibilityRole="button" style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your cart</Text>
        <TouchableOpacity onPress={() => setCurrencyOpen(true)} activeOpacity={0.85} style={styles.currencyButton}>
          <Text style={styles.currencyButtonText}>{selectedCurrency}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isLoading && items.length === 0 ? (
          <View style={styles.stateWrap}>
            <ActivityIndicator color="#076B51" />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.stateWrap}>
            <Ionicons name="cart-outline" size={48} color="#858585" />
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.emptyBody}>Browse foodstuff and add items to get started.</Text>
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/(buyer)/explore", params: { view: "products" } } as any)}
              activeOpacity={0.85}
              style={styles.browseButton}
            >
              <Text style={styles.browseButtonText}>Browse Foodstuff</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.vendorSummaryCard}>
              <Text style={styles.vendorSummaryTitle}>
                {vendorCount > 1 ? `${vendorCount} sellers in this basket` : "1 seller in this basket"}
              </Text>
              <Text style={styles.vendorSummaryBody}>
                Eki can handle one checkout across multiple sellers when the basket stays in the same currency.
              </Text>
            </View>

            {groupedByVendor.map((group) => (
              <View key={group.vendorId} style={styles.vendorSection}>
                <Text style={styles.vendorName}>{group.vendorName || "Vendor"}</Text>
                <Text style={styles.vendorMeta}>
                  {group.items.length} item{group.items.length === 1 ? "" : "s"} · {formatDisplayMoney(group.subtotal, checkoutCurrency, selectedCurrency)}
                </Text>

                {group.items.map((item) => (
                  <View key={item.product.id} style={styles.cartItem}>
                    {item.product.images?.[0] ? (
                      <Image source={{ uri: item.product.images[0] }} style={styles.itemImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.itemImage} />
                    )}
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.product.name}</Text>
                      <Text style={styles.itemCategory}>{item.product.category || group.vendorName}</Text>
                      <Text style={styles.itemPrice}>{formatDisplayMoney(item.product.price, item.product.currency, selectedCurrency)}</Text>
                    </View>
                    <View style={styles.qtyControl}>
                      <TouchableOpacity
                        onPress={() => handleQuantityChange(item.product.id, item.quantity - 1)}
                        activeOpacity={0.85}
                        style={styles.qtyBtn}
                      >
                        <Text style={styles.qtyBtnText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyValue}>{item.quantity}</Text>
                      <TouchableOpacity
                        onPress={() => handleQuantityChange(item.product.id, item.quantity + 1)}
                        activeOpacity={0.85}
                        style={styles.qtyBtnPlus}
                      >
                        <Ionicons name="add" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ))}

            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Items</Text>
                <Text style={styles.summaryValue}>{String(totalItems).padStart(2, "0")}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total item price</Text>
                <Text style={styles.summaryValue}>
                  {formatDisplayMoney(subtotal, checkoutCurrency, selectedCurrency)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total weight</Text>
                <Text style={styles.summaryValue}>{totalWeight.toFixed(1)} kg</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Sellers</Text>
                <Text style={styles.summaryValue}>{vendorCount}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery country</Text>
                <Text style={styles.summaryValue}>{deliveryCountry}</Text>
              </View>
              <View style={[styles.summaryRow, styles.summaryRowBorder]}>
                <Text style={styles.summaryLabel}>Shipping cost</Text>
                <Text style={styles.summaryValue}>
                  {formatDisplayMoney(deliveryTotal, checkoutCurrency, selectedCurrency)}
                </Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatDisplayMoney(grandTotal, checkoutCurrency, selectedCurrency)}</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: TAB_BAR_RESERVED_SPACE + Math.max(insets.bottom, 10) }]}>
        <View style={styles.bottomSummaryRow}>
          <View>
            <Text style={styles.bottomSummaryLabel}>Ready to checkout</Text>
            <Text style={styles.bottomSummaryValue}>{totalItems} items · {formatDisplayMoney(grandTotal, checkoutCurrency, selectedCurrency)}</Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={28} color="#076B51" />
        </View>
        <TouchableOpacity
          onPress={() => items.length > 0 && router.push("/(buyer)/checkout" as any)}
          activeOpacity={0.85}
          style={[styles.checkoutBtn, items.length === 0 && { opacity: 0.5 }]}
          disabled={items.length === 0}
        >
          <Text style={styles.checkoutText}>Proceed to Checkout</Text>
        </TouchableOpacity>
      </View>

      <CurrencySelector
        selectedCurrency={selectedCurrency}
        onChange={setSelectedCurrency}
        visible={currencyOpen}
        onClose={() => setCurrencyOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 22, fontFamily: "Manrope-Bold", color: "#282828" },
  currencyButton: { minWidth: 58, height: 38, borderRadius: 19, backgroundColor: "#EAF5F0", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  currencyButtonText: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#076B51" },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 100 },
  stateWrap: { paddingVertical: 60, alignItems: "center" },
  emptyTitle: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 16 },
  emptyBody: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 6 },
  browseButton: { marginTop: 20, height: 44, borderRadius: 12, backgroundColor: "#076B51", paddingHorizontal: 24, alignItems: "center", justifyContent: "center" },
  browseButtonText: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  vendorSummaryCard: { backgroundColor: "#F4F8F6", borderRadius: 16, padding: 16, marginBottom: 14 },
  vendorSummaryTitle: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828" },
  vendorSummaryBody: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#687076", marginTop: 6, lineHeight: 19 },
  vendorSection: { marginBottom: 18 },
  vendorName: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828" },
  vendorMeta: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#687076", marginTop: 4, marginBottom: 10 },
  cartItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#F0F0F0" },
  itemImage: { width: 72, height: 72, borderRadius: 12, backgroundColor: "#F0E6D4", marginRight: 14 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828" },
  itemCategory: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },
  itemPrice: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 6 },
  qtyControl: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: "#E0E0E0", alignItems: "center", justifyContent: "center" },
  qtyBtnText: { fontSize: 14, color: "#282828" },
  qtyValue: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828", minWidth: 20, textAlign: "center" },
  qtyBtnPlus: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  summaryCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#F0F0F0", marginTop: 8 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7 },
  summaryRowBorder: { borderBottomWidth: 1, borderBottomColor: "#F0F0F0", paddingBottom: 12 },
  summaryLabel: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585" },
  summaryValue: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#282828" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 12 },
  totalLabel: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828" },
  totalValue: { fontSize: 22, fontFamily: "Manrope-Bold", color: "#076B51" },
  bottomBar: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F0F0F0", backgroundColor: "#FFFFFF" },
  bottomSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F4F8F6",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  bottomSummaryLabel: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#687076" },
  bottomSummaryValue: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 4 },
  checkoutBtn: { height: 56, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  checkoutText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
});
