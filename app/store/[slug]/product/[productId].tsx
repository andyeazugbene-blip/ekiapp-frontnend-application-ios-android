import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { RemoteImage } from "../../../../components/ui/RemoteImage";
import { publicStoreService } from "../../../../services/publicStoreService";
import { usePublicStoreCartStore } from "../../../../stores/publicStoreCartStore";
import type { Product } from "../../../../types/product";
import type { VendorSummary } from "../../../../types/vendor";

const CURRENCY_SYMBOL: Record<string, string> = {
  GBP: "\u00A3",
  USD: "$",
  EUR: "\u20AC",
  NGN: "\u20A6",
  CAD: "C$",
};

function formatMoney(value: number, currency = "GBP"): string {
  const symbol = CURRENCY_SYMBOL[currency] ?? "\u00A3";
  return `${symbol}${value.toFixed(2)}`;
}

function productUnitLabel(product: Product): string {
  if (product.unit) return product.unit;
  if (product.weight) return `${Math.round(product.weight * 1000)}g`;
  return "Pack";
}

export default function PublicStoreProductScreen() {
  const router = useRouter();
  const { slug, productId } = useLocalSearchParams<{ slug?: string; productId?: string }>();

  const cartsBySlug = usePublicStoreCartStore((state) => state.cartsBySlug);
  const addCartItem = usePublicStoreCartStore((state) => state.addItem);

  const [vendor, setVendor] = useState<VendorSummary | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const cart = slug ? cartsBySlug[slug] ?? {} : {};
  const quantityInCart = product ? cart[product.id] ?? 0 : 0;
  const totalItems = useMemo(
    () => Object.values(cart).reduce((sum, quantity) => sum + quantity, 0),
    [cart],
  );

  useEffect(() => {
    if (!slug || !productId) {
      setError("Missing product details.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const [nextVendor, products] = await Promise.all([
          publicStoreService.getStore(slug),
          publicStoreService.listProducts(slug, { limit: 48 }),
        ]);

        if (cancelled) return;

        const nextProduct = products.find((entry) => entry.id === productId) ?? null;
        setVendor(nextVendor);
        setProduct(nextProduct);
        if (!nextProduct) {
          setError("This product is no longer available.");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not open this product.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productId, slug]);

  const handleAddToCart = () => {
    if (!slug || !product) return;

    addCartItem(slug, product.id, 1);
    setActionError("");
  };

  const handleNavigateToStore = (panel: "cart" | "checkout" | "find") => {
    if (!slug) return;

    router.push({
      pathname: "/store/[slug]",
      params: { slug, panel },
    } as any);
  };

  if (loading) {
    return (
      <View style={styles.stateScreen}>
        <ActivityIndicator color="#076B51" />
      </View>
    );
  }

  if (!product || !vendor) {
    return (
      <SafeAreaView style={styles.stateScreen}>
        <Ionicons name="basket-outline" size={38} color="#9AA3A0" />
        <Text style={styles.stateTitle}>{error || "Product not found."}</Text>
        <TouchableOpacity
          onPress={() => slug && router.replace({ pathname: "/store/[slug]", params: { slug } } as any)}
          activeOpacity={0.88}
          style={styles.primaryAction}
        >
          <Text style={styles.primaryActionText}>Back to store</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.88} style={styles.backButton}>
            <Ionicons name="arrow-back" size={18} color="#1F1B16" />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => handleNavigateToStore(totalItems > 0 ? "cart" : "find")}
            style={styles.cartButton}
          >
            <Text style={styles.cartButtonText}>
              {totalItems > 0 ? `Cart (${totalItems})` : "Track order"}
            </Text>
          </TouchableOpacity>
        </View>

        <RemoteImage
          uri={product.images?.[0]}
          style={styles.productImage}
          borderRadius={28}
          fallbackIcon="storefront-outline"
        />

        <View style={styles.card}>
          <Text style={styles.kicker}>{vendor.storeName}</Text>
          <Text style={styles.title}>{product.name}</Text>
          <Text style={styles.meta}>
            {productUnitLabel(product)} · Ships from {vendor.city || vendor.country || "this vendor"}
          </Text>
          <Text style={styles.description}>
            {product.description || "Freshly packed and ready for secure checkout on Culinary Tales."}
          </Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatMoney(product.price, product.currency)}</Text>
            <View style={styles.stockPill}>
              <Text style={styles.stockPillText}>{product.stock > 0 ? "In stock" : "Sold out"}</Text>
            </View>
          </View>

          <View style={styles.infoGrid}>
            <InfoCard icon="shield-checkmark-outline" title="Secure payment" body="Protected browser payment keeps each order and delivery record in sync." />
            <InfoCard icon="mail-outline" title="Email tracking" body="Use your checkout email to reopen and track orders quickly." />
            <InfoCard icon="cart-outline" title="Shared cart" body="Add this product, then finish checkout from the store cart." />
          </View>

          {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}

          <View style={styles.actionStack}>
            <TouchableOpacity
              onPress={handleAddToCart}
              activeOpacity={0.88}
              style={[styles.primaryAction, product.stock <= 0 && styles.disabledAction]}
              disabled={product.stock <= 0}
            >
              <Text style={styles.primaryActionText}>
                {quantityInCart > 0 ? `Add another · ${quantityInCart} in cart` : "Add to cart"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                handleAddToCart();
                handleNavigateToStore("checkout");
              }}
              activeOpacity={0.88}
              style={[styles.secondaryAction, product.stock <= 0 && styles.disabledAction]}
              disabled={product.stock <= 0}
            >
              <Text style={styles.secondaryActionText}>Buy now</Text>
            </TouchableOpacity>

            <View style={styles.inlineActions}>
              <TouchableOpacity onPress={() => handleNavigateToStore("cart")} activeOpacity={0.88} style={styles.inlineChip}>
                <Text style={styles.inlineChipText}>View cart</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleNavigateToStore("find")} activeOpacity={0.88} style={styles.inlineChip}>
                <Text style={styles.inlineChipText}>Track order by email</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoCard({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  return (
    <View style={styles.infoCard}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={18} color="#0A6C52" />
      </View>
      <Text style={styles.infoTitle}>{title}</Text>
      <Text style={styles.infoBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F4F6F5",
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "web" ? 24 : 18,
    paddingBottom: 96,
    gap: 18,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E4E8E6",
  },
  cartButton: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#0A6C52",
    alignItems: "center",
    justifyContent: "center",
  },
  cartButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Manrope-Bold",
  },
  productImage: {
    width: "100%",
    minHeight: 320,
    backgroundColor: "#EDE7DB",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#E4E8E6",
    padding: 22,
    gap: 14,
  },
  kicker: {
    color: "#687076",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Outfit-Medium",
    textTransform: "uppercase",
  },
  title: {
    color: "#1F1B16",
    fontSize: 30,
    lineHeight: 36,
    fontFamily: "Manrope-Bold",
  },
  meta: {
    color: "#687076",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Outfit-Regular",
  },
  description: {
    color: "#2B2B2B",
    fontSize: 15,
    lineHeight: 24,
    fontFamily: "Outfit-Regular",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  price: {
    color: "#0A6C52",
    fontSize: 28,
    lineHeight: 34,
    fontFamily: "Manrope-Bold",
  },
  stockPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#E9F3EF",
  },
  stockPillText: {
    color: "#0A6C52",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Outfit-Medium",
  },
  infoGrid: {
    gap: 12,
  },
  infoCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E4E8E6",
    backgroundColor: "#F8FAF9",
    padding: 16,
    gap: 8,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E8F3EE",
    alignItems: "center",
    justifyContent: "center",
  },
  infoTitle: {
    color: "#1F1B16",
    fontSize: 15,
    lineHeight: 21,
    fontFamily: "Manrope-Bold",
  },
  infoBody: {
    color: "#687076",
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "Outfit-Regular",
  },
  actionStack: {
    gap: 12,
  },
  primaryAction: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "#0A6C52",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 21,
    fontFamily: "Manrope-Bold",
  },
  secondaryAction: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D5DDD9",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  secondaryActionText: {
    color: "#1F1B16",
    fontSize: 15,
    lineHeight: 21,
    fontFamily: "Manrope-Bold",
  },
  inlineActions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  inlineChip: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#F4F6F5",
    borderWidth: 1,
    borderColor: "#E4E8E6",
    alignItems: "center",
    justifyContent: "center",
  },
  inlineChipText: {
    color: "#1F1B16",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-Medium",
  },
  disabledAction: {
    opacity: 0.45,
  },
  errorText: {
    color: "#B42318",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-Regular",
  },
  stateScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#F4F6F5",
    gap: 12,
  },
  stateTitle: {
    color: "#1F1B16",
    fontSize: 18,
    lineHeight: 24,
    fontFamily: "Manrope-Bold",
    textAlign: "center",
  },
});
