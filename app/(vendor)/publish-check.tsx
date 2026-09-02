import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { useAuthStore } from "../../stores/authStore";
import { productService } from "../../services/productService";
import { deliveryService } from "../../services/deliveryService";
import { ApiRequestError } from "../../services/api";
import { Product } from "../../types/product";

function parseMoneyInput(value: string): number {
  const normalized = (value ?? "").replace(",", ".").replace(/[^\d.]/g, "");
  return Number(normalized) || 0;
}

export default function PublishCheckScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    name?: string;
    description?: string;
    price?: string;
    costPrice?: string;
    weight?: string;
    unit?: string;
    stock?: string;
    category?: string;
    imageUrl?: string;
  }>();
  const user = useAuthStore((s) => s.user);
  const vendor = user?.role === "vendor" ? user : null;

  const [hasDelivery, setHasDelivery] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [published, setPublished] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    deliveryService.listZones()
      .then((zones) => setHasDelivery((zones ?? []).length > 0))
      .catch(() => setHasDelivery(false));
  }, []);

  const name = params.name ?? "";
  const category = params.category ?? "";
  const imageUrl = params.imageUrl ?? "";
  const price = parseMoneyInput(params.price ?? "");
  const stock = Number(params.stock) || 0;

  const CHECKS = [
    { label: "Image added", done: !!imageUrl },
    { label: "Name added", done: !!name.trim() },
    { label: "Category selected", done: !!category.trim() },
    { label: "Price added", done: price > 0 },
    { label: "Stock available", done: stock > 0 },
    { label: "Delivery set", done: hasDelivery },
  ];
  const allDone = CHECKS.every((item) => item.done);

  const handlePublish = async () => {
    if (!allDone || !vendor) return;
    setSubmitting(true);
    setError("");
    setNeedsVerification(false);
    try {
      const payload: Omit<Product, "id" | "createdAt" | "updatedAt"> = {
        name: name.trim(),
        description: (params.description ?? "").trim(),
        price,
        costPrice: params.costPrice?.trim() ? parseMoneyInput(params.costPrice) : undefined,
        currency: "GBP",
        images: imageUrl ? [imageUrl] : [],
        category: category || "General",
        vendorId: vendor.id,
        vendorName: vendor.storeName,
        vendorCity: vendor.city ?? "",
        stock,
        status: "active",
        weight: Number(params.weight) || 0,
        unit: params.unit || "kg",
      };
      const product = await productService.createProduct(payload);
      setPublished({ id: product.id, name: product.name });
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 403) {
        setError("You need to verify your account before publishing.");
        setNeedsVerification(true);
        return;
      }
      setError(err instanceof Error ? err.message : "Could not publish foodstuff.");
    } finally {
      setSubmitting(false);
    }
  };

  if (published) {
    return (
      <View style={styles.page}>
        <SafeAreaView edges={["top", "bottom"]} style={styles.successSafe}>
          <View style={styles.successBody}>
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark" size={40} color="#FFFFFF" />
            </View>
            <Text style={styles.successTitle}>Your foodstuff is live!</Text>
            <Text style={styles.successSubtitle}>
              {published.name} is now available for customers to order.
            </Text>
          </View>

          <View style={styles.bottomBar}>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.86}
              onPress={() => router.replace(`/(vendor)/foodstuff-detail?id=${published.id}` as any)}
              style={styles.publishButton}
            >
              <Text style={styles.publishText}>View listing</Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.86}
              onPress={() => router.replace("/(vendor)/foodstuff" as any)}
              style={styles.fixButton}
            >
              <Text style={styles.fixText}>Back to products</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityLabel="Go back"
            accessibilityRole="button"
            onPress={() => goBackOrReplace(router, "/(vendor)/foodstuff-add" as any)}
            style={styles.backButton}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Before This Foodstuff Goes Live</Text>
          <Text style={styles.headerSubtitle}>Review the checklist to ensure a perfect listing.</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.checkList}>
            {CHECKS.map((check) => (
              <View key={check.label} style={styles.checkRow}>
                <Text style={styles.checkLabel}>{check.label}</Text>
                <View style={[styles.stateBadge, check.done ? styles.doneBadge : styles.missingBadge]}>
                  <Ionicons
                    name={check.done ? "checkmark" : "close"}
                    size={13}
                    color={check.done ? "#076B51" : "#FF5F5F"}
                  />
                </View>
              </View>
            ))}
          </View>

          {!allDone ? (
            <View style={styles.warningBox}>
              <Ionicons name="warning-outline" size={17} color="#FF5F5F" />
              <Text style={styles.warningText}>
                Complete {CHECKS.filter((c) => !c.done).map((c) => c.label).join(", ")} before buyers can order this foodstuff
              </Text>
            </View>
          ) : null}

          {error ? <Text style={styles.warningText}>{error}</Text> : null}

          {needsVerification ? (
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.86}
              onPress={() => router.push("/(vendor-verification)" as any)}
              style={styles.verifyNowButton}
            >
              <Text style={styles.verifyNowText}>Verify now</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={styles.bottomBar}>
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={allDone ? 0.86 : 1}
          disabled={!allDone || submitting}
          onPress={handlePublish}
          style={[styles.publishButton, (!allDone || submitting) && styles.publishDisabled]}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.publishText}>Publish</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.86}
          onPress={() => goBackOrReplace(router, "/(vendor)/foodstuff-add" as any)}
          style={styles.fixButton}
        >
          <Ionicons name="arrow-back" size={16} color="#076B51" />
          <Text style={styles.fixText}>Fix Missing Info</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F4F4F4",
  },
  headerSafeArea: {
    backgroundColor: "#076B51",
  },
  header: {
    backgroundColor: "#076B51",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 26,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Manrope-Bold",
    lineHeight: 27,
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: "Outfit-Regular",
    color: "rgba(255,255,255,0.78)",
    marginTop: 6,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 20,
  },
  checkList: {
    gap: 12,
  },
  checkRow: {
    height: 50,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#F4F4F4",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 16,
    paddingRight: 15,
  },
  checkLabel: {
    color: "#282828",
    fontFamily: "Manrope-Bold",
    fontSize: 14,
  },
  stateBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  doneBadge: {
    backgroundColor: "#DCEBE7",
  },
  missingBadge: {
    backgroundColor: "#FFEAEA",
  },
  warningBox: {
    minHeight: 56,
    borderRadius: 9,
    backgroundColor: "#FFEAEA",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginTop: 16,
  },
  warningText: {
    flex: 1,
    color: "#FF5F5F",
    fontFamily: "Outfit-Regular",
    fontSize: 14,
    lineHeight: 18,
    marginLeft: 12,
  },
  verifyNowButton: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  verifyNowText: {
    color: "#076B51",
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 12,
    backgroundColor: "#F4F4F4",
  },
  publishButton: {
    height: 58,
    borderRadius: 12,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
  },
  publishDisabled: {
    backgroundColor: "#BBD8D0",
  },
  publishText: {
    color: "#FFFFFF",
    fontFamily: "Manrope-SemiBold",
    fontSize: 17,
  },
  fixButton: {
    height: 58,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#076B51",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  fixText: {
    color: "#076B51",
    fontFamily: "Manrope-SemiBold",
    fontSize: 16,
    marginLeft: 10,
  },
  successSafe: {
    flex: 1,
    justifyContent: "space-between",
  },
  successBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
  },
  successIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  successTitle: {
    color: "#282828",
    fontFamily: "Manrope-Bold",
    fontSize: 22,
    lineHeight: 28,
    textAlign: "center",
    marginBottom: 10,
  },
  successSubtitle: {
    color: "#858585",
    fontFamily: "Outfit-Regular",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
