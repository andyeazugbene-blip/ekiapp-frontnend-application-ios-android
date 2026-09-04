import React, { useCallback } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFavoritesStore } from "../../stores/favoritesStore";
import { useAuthStore } from "../../stores/authStore";
import { useCurrencyStore } from "../../stores/currencyStore";
import { formatDisplayMoney } from "../../utils/currency";
import { goBackOrReplace } from "../../utils/navigation";
import { RemoteImage } from "../../components/ui/RemoteImage";

export default function FavoritesScreen() {
  const router = useRouter();
  const products = useFavoritesStore((s) => s.products);
  const load = useFavoritesStore((s) => s.load);
  const removeFavorite = useFavoritesStore((s) => s.removeFavorite);
  const selectedCurrency = useCurrencyStore((s) => s.selectedCurrency);
  const userId = useAuthStore((s) => s.user?.id);

  useFocusEffect(
    useCallback(() => {
      load(userId);
    }, [load, userId])
  );

  const handleOpen = (productId: string) => {
    router.push({ pathname: "/(buyer)/product-detail", params: { id: productId } } as any);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)/profile" as any)} activeOpacity={0.85} accessibilityLabel="Go back" accessibilityRole="button" style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Favorites</Text>
        <Text style={styles.headerSubtitle}>Products you've saved</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {products.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Ionicons name="heart-outline" size={42} color="#C5C5C5" />
            <Text style={styles.emptyTitle}>No favorites yet</Text>
            <Text style={styles.emptyBody}>Tap the heart on any product to save it here.</Text>
            <TouchableOpacity onPress={() => router.push({ pathname: "/(buyer)/explore", params: { view: "products" } } as any)} activeOpacity={0.85} style={styles.browseButton}>
              <Text style={styles.browseButtonText}>Browse foodstuff</Text>
            </TouchableOpacity>
          </View>
        ) : (
          products.map((product) => (
            <TouchableOpacity key={product.id} onPress={() => handleOpen(product.id)} activeOpacity={0.85} style={styles.productCard}>
              <View style={styles.productImage}>
                <RemoteImage uri={product.images?.[0]} style={styles.productImageInner} />
              </View>
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                <Text style={styles.productMeta} numberOfLines={1}>{product.vendorName}</Text>
                <Text style={styles.productPrice}>{formatDisplayMoney(product.price, product.currency, selectedCurrency)}</Text>
              </View>
              <TouchableOpacity onPress={() => removeFavorite(product.id, userId)} activeOpacity={0.85} style={styles.removeButton}>
                <Ionicons name="heart" size={18} color="#FB6363" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: { backgroundColor: "#076B51", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, gap: 4 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  headerTitle: { fontSize: 28, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 14, fontFamily: "Outfit-Light", color: "rgba(255,255,255,0.8)" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  emptyBlock: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 16 },
  emptyBody: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 6, textAlign: "center" },
  browseButton: { marginTop: 20, height: 48, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  browseButtonText: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  productCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 18, padding: 14, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  productImage: { width: 64, height: 64, borderRadius: 14, backgroundColor: "#F4F4F4", marginRight: 14, overflow: "hidden" },
  productImageInner: { flex: 1, width: "100%", height: "100%", borderRadius: 14, backgroundColor: "#E8E8E8" },
  productInfo: { flex: 1 },
  productName: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828" },
  productMeta: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },
  productPrice: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#076B51", marginTop: 4 },
  removeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(251,99,99,0.1)", alignItems: "center", justifyContent: "center", marginLeft: 8 },
});
