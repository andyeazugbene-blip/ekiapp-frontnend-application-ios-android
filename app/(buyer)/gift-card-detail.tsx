import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { giftCardService, type GiftCard } from "../../services/giftCardService";
import { RemoteImage } from "../../components/ui/RemoteImage";
import { goBackOrReplace } from "../../utils/navigation";

export default function GiftCardDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [card, setCard] = useState<GiftCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("Gift card not found.");
      return;
    }

    let cancelled = false;
    setLoading(true);
    giftCardService
      .getActive()
      .then((cards) => {
        if (cancelled) return;
        const match = cards.find((item) => item.id === id) ?? null;
        setCard(match);
        if (!match) setError("This gift card is no longer available.");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load gift card.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.headerSafe}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)" as any)} activeOpacity={0.86} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={22} color="#0A6C52" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gift Card</Text>
        <View style={styles.headerButton} />
      </SafeAreaView>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color="#076B51" />
        </View>
      ) : !card ? (
        <View style={styles.centerFill}>
          <Ionicons name="gift-outline" size={40} color="#B0B0B0" />
          <Text style={styles.errorText}>{error || "Gift card not found."}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.imageWrap}>
            <RemoteImage uri={card.imageUrl} style={styles.image} borderRadius={22} fallbackIcon="gift-outline" />
          </View>

          <Text style={styles.title}>{card.title}</Text>
          <Text style={styles.price}>{card.currency} {card.priceFormatted}</Text>

          {card.description ? <Text style={styles.description}>{card.description}</Text> : null}

          {error ? <Text style={styles.inlineError}>{error}</Text> : null}

          <View style={styles.rewardBanner}>
            <Ionicons name="gift-outline" size={22} color="#076B51" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.rewardBannerTitle}>Reward Gift Card</Text>
              <Text style={styles.rewardBannerText}>
                Earn this gift card by completing orders, referring friends, or meeting campaign requirements.
              </Text>
            </View>
          </View>
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
    gap: 10,
    paddingHorizontal: 24,
  },
  errorText: {
    color: "#7A7F84",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Outfit-Regular",
    textAlign: "center",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  imageWrap: {
    width: "100%",
    height: 200,
    marginTop: 6,
    marginBottom: 20,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  title: {
    color: "#2B2B2B",
    fontSize: 22,
    fontFamily: "Manrope-ExtraBold",
  },
  price: {
    color: "#0A6C52",
    fontSize: 26,
    fontFamily: "Manrope-ExtraBold",
    marginTop: 6,
  },
  description: {
    color: "#6E7377",
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Outfit-Regular",
    marginTop: 14,
  },
  inlineError: {
    color: "#D6552F",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-Regular",
    marginTop: 14,
  },
  rewardBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F7F4",
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#D6EDE5",
  },
  rewardBannerTitle: {
    fontSize: 15,
    fontFamily: "Manrope-Bold",
    color: "#076B51",
  },
  rewardBannerText: {
    fontSize: 13,
    fontFamily: "Outfit-Regular",
    color: "#858585",
    marginTop: 4,
    lineHeight: 18,
  },
  buyButton: {
    height: 58,
    borderRadius: 18,
    backgroundColor: "#0A6C52",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 28,
  },
  buyButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Manrope-Bold",
  },
  inlineHint: {
    color: "#7A7F84",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Outfit-Regular",
    marginTop: 12,
    textAlign: "center",
  },
});
