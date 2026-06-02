import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
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
  return "pack";
}

function buildProductCode(name: string): string {
  const initials = name
    .split(/\s+/)
    .map((part) => part.trim().charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("");
  return initials.toUpperCase() || "EK";
}

export default function PublicStoreProductScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 980;
  const { slug, productId } = useLocalSearchParams<{ slug?: string; productId?: string }>();

  const cartsBySlug = usePublicStoreCartStore((state) => state.cartsBySlug);
  const addCartItem = usePublicStoreCartStore((state) => state.addItem);
  const decrementCartItem = usePublicStoreCartStore((state) => state.decrementItem);

  const [vendor, setVendor] = useState<VendorSummary | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const handleAddToCart = (amount = 1) => {
    if (!slug || !product) return;
    addCartItem(slug, product.id, amount);
  };

  const handleViewCart = () => {
    if (!slug) return;
    router.push({ pathname: "/store/[slug]", params: { slug, panel: totalItems > 0 ? "cart" : "find" } } as any);
  };

  const handleBuyNow = () => {
    if (!slug || !product) return;
    if (quantityInCart <= 0) {
      addCartItem(slug, product.id, 1);
    }
    router.push({ pathname: "/store/[slug]", params: { slug, panel: "checkout" } } as any);
  };

  if (loading) {
    return (
      <View style={styles.stateScreen}>
        <ActivityIndicator color="#174C3A" />
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
      <View style={styles.topRibbon}>
        <Text style={styles.topRibbonBrand}>eki.</Text>
        <Text style={styles.topRibbonCaption}>Secure Checkout</Text>
        <TouchableOpacity activeOpacity={0.88} onPress={handleViewCart} style={styles.topRibbonCart}>
          <Text style={styles.topRibbonCartText}>{totalItems > 0 ? `View Cart (${totalItems})` : "Track Order"}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.layout, isDesktop && styles.layoutDesktop]}>
          <View style={styles.mediaPanel}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.88} style={styles.backButton}>
              <Ionicons name="arrow-back" size={18} color="#1F1B16" />
            </TouchableOpacity>
            <View style={styles.stockPill}>
              <Text style={styles.stockPillText}>{product.stock > 0 ? "In Stock" : "Sold out"}</Text>
            </View>
            <RemoteImage
              uri={product.images?.[0]}
              style={styles.productImage}
              borderRadius={0}
              fallbackIcon="storefront-outline"
            />
            <View style={styles.productCodeBadge}>
              <Text style={styles.productCodeBadgeText}>{buildProductCode(product.name)}</Text>
            </View>
          </View>

          <View style={styles.detailPanel}>
            <TouchableOpacity
              onPress={() => slug && router.push({ pathname: "/store/[slug]", params: { slug } } as any)}
              activeOpacity={0.88}
            >
              <Text style={styles.backToProducts}>← Back to all products</Text>
            </TouchableOpacity>

            <View style={styles.vendorChip}>
              <Ionicons name="checkmark-circle" size={12} color="#0A6C52" />
              <Text style={styles.vendorChipText}>Sold by {vendor.storeName}</Text>
            </View>

            <Text style={styles.title}>{product.name}</Text>
            <Text style={styles.meta}>
              {productUnitLabel(product)} · Ships from {vendor.city || vendor.country || "this vendor"} · Delivery 2-4 days
            </Text>
            <Text style={styles.price}>{formatMoney(product.price, product.currency)}</Text>

            <View style={styles.descriptionBox}>
              <Text style={styles.description}>
                {product.description || "Freshly dried and packed premium foodstuff sourced from trusted farms and vendors."}
              </Text>
            </View>

            <View style={styles.qtySection}>
              <Text style={styles.qtyLabel}>Quantity</Text>
              <View style={styles.quantityControl}>
                <TouchableOpacity
                  onPress={() => product && quantityInCart > 0 && decrementCartItem(slug!, product.id)}
                  activeOpacity={0.88}
                  style={styles.quantityButton}
                >
                  <Ionicons name="remove" size={16} color="#174C3A" />
                </TouchableOpacity>
                <Text style={styles.quantityValue}>{Math.max(quantityInCart, 1)}</Text>
                <TouchableOpacity onPress={() => handleAddToCart(1)} activeOpacity={0.88} style={styles.quantityButton}>
                  <Ionicons name="add" size={16} color="#174C3A" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.securityRail}>
              <Text style={styles.securityRailText}>Secure checkout</Text>
              <Text style={styles.securityRailDivider}>·</Text>
              <Text style={styles.securityRailText}>Order recorded on Eki</Text>
            </View>

            <TouchableOpacity
              onPress={handleBuyNow}
              activeOpacity={0.88}
              style={[styles.primaryAction, product.stock <= 0 && styles.disabledAction]}
              disabled={product.stock <= 0}
            >
              <Text style={styles.primaryActionText}>Add to Cart — {formatMoney(product.price, product.currency)}</Text>
            </TouchableOpacity>

            <View style={styles.secondaryRow}>
              <TouchableOpacity onPress={handleViewCart} activeOpacity={0.88} style={styles.secondaryAction}>
                <Text style={styles.secondaryActionText}>View cart</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => slug && router.push({ pathname: "/store/[slug]", params: { slug, panel: "find" } } as any)}
                activeOpacity={0.88}
                style={styles.secondaryAction}
              >
                <Text style={styles.secondaryActionText}>Track order by email</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAF8",
  },
  topRibbon: {
    marginHorizontal: 16,
    marginTop: 12,
    minHeight: 42,
    borderRadius: 6,
    backgroundColor: "#174C3A",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  topRibbonBrand: {
    color: "#FFFFFF",
    fontSize: 18,
    lineHeight: 22,
    fontFamily: "Manrope-ExtraBold",
  },
  topRibbonCaption: {
    flex: 1,
    textAlign: "center",
    color: "rgba(255,255,255,0.8)",
    fontSize: 10,
    lineHeight: 14,
    fontFamily: "Outfit-Medium",
  },
  topRibbonCart: {
    minHeight: 28,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  topRibbonCartText: {
    color: "#FFFFFF",
    fontSize: 11,
    lineHeight: 15,
    fontFamily: "Manrope-Bold",
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  layout: {
    gap: 0,
  },
  layoutDesktop: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  mediaPanel: {
    flex: 1,
    minHeight: 540,
    backgroundColor: "#E9F3EA",
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    position: "relative",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  detailPanel: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderWidth: 1,
    borderColor: "#E2EAE5",
    padding: 24,
  },
  backButton: {
    position: "absolute",
    left: 16,
    top: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  stockPill: {
    position: "absolute",
    right: 16,
    top: 16,
    minHeight: 26,
    borderRadius: 999,
    backgroundColor: "#174C3A",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  stockPillText: {
    color: "#FFFFFF",
    fontSize: 10,
    lineHeight: 12,
    fontFamily: "Manrope-Bold",
  },
  productImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#E9F3EA",
  },
  productCodeBadge: {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: [{ translateX: -44 }, { translateY: -18 }],
    minWidth: 88,
    minHeight: 36,
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: "#CFE7D8",
    alignItems: "center",
    justifyContent: "center",
  },
  productCodeBadgeText: {
    color: "#2B6A56",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Manrope-Bold",
  },
  backToProducts: {
    color: "#6C816F",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Outfit-Medium",
  },
  vendorChip: {
    alignSelf: "flex-start",
    marginTop: 12,
    borderRadius: 999,
    backgroundColor: "#EAF7F1",
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  vendorChipText: {
    color: "#0A6C52",
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "Manrope-Bold",
  },
  title: {
    color: "#1F1B16",
    fontSize: 34,
    lineHeight: 40,
    fontFamily: "Manrope-Bold",
    marginTop: 14,
  },
  meta: {
    color: "#687076",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-Regular",
    marginTop: 6,
  },
  price: {
    color: "#174C3A",
    fontSize: 34,
    lineHeight: 40,
    fontFamily: "Manrope-Bold",
    marginTop: 14,
  },
  descriptionBox: {
    marginTop: 16,
    borderRadius: 6,
    backgroundColor: "#F7F9F8",
    padding: 14,
  },
  description: {
    color: "#52625A",
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "Outfit-Regular",
  },
  qtySection: {
    marginTop: 16,
  },
  qtyLabel: {
    color: "#687076",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Outfit-Medium",
    marginBottom: 8,
  },
  quantityControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  quantityButton: {
    width: 34,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#D4DDD8",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  quantityValue: {
    minWidth: 18,
    color: "#2B2B2B",
    fontSize: 16,
    lineHeight: 20,
    fontFamily: "Manrope-Bold",
    textAlign: "center",
  },
  securityRail: {
    marginTop: 18,
    minHeight: 38,
    borderRadius: 6,
    backgroundColor: "#F3FBF6",
    borderWidth: 1,
    borderColor: "#CFE3D8",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  securityRailText: {
    color: "#0A6C52",
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "Manrope-SemiBold",
  },
  securityRailDivider: {
    color: "#8FB7A6",
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "Manrope-Bold",
  },
  primaryAction: {
    marginTop: 14,
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: "#174C3A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "Manrope-Bold",
  },
  secondaryRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  secondaryAction: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D7E1DD",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionText: {
    color: "#174C3A",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Manrope-SemiBold",
  },
  disabledAction: {
    opacity: 0.45,
  },
  stateScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#F8FAF8",
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
