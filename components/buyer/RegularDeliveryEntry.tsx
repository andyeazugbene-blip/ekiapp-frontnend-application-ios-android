import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { regularDeliveriesService, type PublicOfferSummary } from "../../services/regularDeliveriesService";

const COPY = {
  store: { title: "Foodstuffs Subscription", action: "See this store's regular delivery offer" },
  product: { title: "Receive regularly", action: "Set up a regular delivery of this product" },
  basket: { title: "Make this a regular order", action: "Get these items delivered on a schedule" },
} as const;

/** Offer's id plus the requested items it actually covers, or null if none. */
export function findOfferFor(offers: PublicOfferSummary[], productIds: string[]): PublicOfferSummary | null {
  if (productIds.length === 0) return offers[0] ?? null;
  return offers.find((offer) => offer.products.some((p) => productIds.includes(p.productId))) ?? null;
}

/**
 * Entry into the existing subscription setup from a store, product or basket
 * (spec A, B01-B04). Renders nothing unless this vendor has a real offer that
 * covers these items, so a buyer never reaches a dead end.
 */
export function RegularDeliveryEntry({ vendorId, mode, items = [] }: {
  vendorId: string | undefined;
  mode: keyof typeof COPY;
  items?: { productId: string; quantity: number }[];
}) {
  const router = useRouter();
  const [offer, setOffer] = useState<PublicOfferSummary | null>(null);
  const productKey = items.map((i) => i.productId).join(",");

  useEffect(() => {
    if (!vendorId) {
      setOffer(null);
      return;
    }
    let active = true;
    regularDeliveriesService
      .listPublicOffers({ vendorId })
      .then((offers) => { if (active) setOffer(findOfferFor(offers, productKey ? productKey.split(",") : [])); })
      .catch(() => { if (active) setOffer(null); });
    return () => { active = false; };
  }, [vendorId, productKey]);

  if (!offer) return null;

  const covered = items.filter((i) => offer.products.some((p) => p.productId === i.productId));
  const open = () => router.push({
    pathname: "/(buyer)/regular-delivery-offer",
    params: { id: offer.id, ...(covered.length > 0 ? { items: covered.map((i) => `${i.productId}:${i.quantity}`).join(",") } : {}) },
  } as any);
  const copy = COPY[mode];

  return (
    <TouchableOpacity onPress={open} activeOpacity={0.86} style={styles.card} accessibilityRole="button" accessibilityLabel={`${copy.title}. ${copy.action}`}>
      <View style={styles.icon}><Ionicons name="repeat-outline" size={20} color="#076B51" /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.action}>{copy.action}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#8AA194" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, backgroundColor: "#EFF7F3", marginVertical: 12 },
  icon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#12221A" },
  action: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#5B6D64", marginTop: 2 },
});
