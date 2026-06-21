import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { giftCardService, type GiftCard, type PurchasedGiftCard } from "../../services/giftCardService";
import { RemoteImage } from "../../components/ui/RemoteImage";
import { goBackOrReplace } from "../../utils/navigation";

export default function GiftCardsScreen() {
  const router = useRouter();
  const [active, setActive] = useState<GiftCard[]>([]);
  const [purchased, setPurchased] = useState<PurchasedGiftCard[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      giftCardService.getActive().catch(() => [] as GiftCard[]),
      giftCardService.getPurchased().catch(() => [] as PurchasedGiftCard[]),
    ])
      .then(([nextActive, nextPurchased]) => {
        setActive(nextActive);
        setPurchased(nextPurchased);
      })
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.headerSafe}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)" as any)} activeOpacity={0.86} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={22} color="#0A6C52" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gift Cards</Text>
        <View style={styles.headerButton} />
      </SafeAreaView>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color="#076B51" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Available Gift Cards</Text>
          {active.length === 0 ? (
            <Text style={styles.emptyText}>No gift cards available right now.</Text>
          ) : (
            <View style={styles.grid}>
              {active.map((card) => (
                <TouchableOpacity
                  key={card.id}
                  onPress={() => router.push({ pathname: "/(buyer)/gift-card-detail", params: { id: card.id } } as any)}
                  activeOpacity={0.86}
                  style={styles.gridCard}
                >
                  <RemoteImage uri={card.imageUrl} style={styles.gridImage} borderRadius={16} fallbackIcon="gift-outline" />
                  <Text style={styles.gridTitle} numberOfLines={1}>{card.title}</Text>
                  <Text style={styles.gridPrice}>{card.currency} {card.priceFormatted}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={[styles.sectionTitle, { marginTop: 28 }]}>My Gift Cards</Text>
          {purchased.length === 0 ? (
            <Text style={styles.emptyText}>You haven't bought any gift cards yet.</Text>
          ) : (
            purchased.map((item) => (
              <View key={item.id} style={styles.purchasedRow}>
                <View style={styles.purchasedIconWrap}>
                  <Ionicons name="gift" size={22} color="#0A8C6A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.purchasedTitle}>{item.title}</Text>
                  <Text style={styles.purchasedMeta}>
                    {item.isRedeemed ? "Redeemed" : "Active"} · {item.currency} {(item.amount / 100).toFixed(2)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F5F0" },
  headerSafe: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#2B2B2B",
    fontSize: 17,
    fontFamily: "Manrope-Bold",
  },
  centerFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  sectionTitle: {
    color: "#2B2B2B",
    fontSize: 18,
    fontFamily: "Manrope-Bold",
    marginBottom: 14,
  },
  emptyText: {
    color: "#7A7F84",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Outfit-Regular",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  gridCard: {
    width: "47%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 14,
    alignItems: "center",
  },
  gridImage: {
    width: 72,
    height: 72,
    marginBottom: 10,
  },
  gridTitle: {
    color: "#2B2B2B",
    fontSize: 14,
    fontFamily: "Manrope-Bold",
    textAlign: "center",
  },
  gridPrice: {
    color: "#0A6C52",
    fontSize: 13,
    fontFamily: "Outfit-Medium",
    marginTop: 4,
  },
  purchasedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  purchasedIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#EAF5F0",
    alignItems: "center",
    justifyContent: "center",
  },
  purchasedTitle: {
    color: "#2B2B2B",
    fontSize: 15,
    fontFamily: "Manrope-Bold",
  },
  purchasedMeta: {
    color: "#7A7F84",
    fontSize: 13,
    fontFamily: "Outfit-Regular",
    marginTop: 2,
  },
});
