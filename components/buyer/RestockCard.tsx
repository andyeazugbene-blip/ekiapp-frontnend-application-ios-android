import React, { useState } from "react";
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { useCartStore } from "../../stores/cartStore";
import type { Order } from "../../types/order";
import { RegularDeliveryEntry } from "./RegularDeliveryEntry";

const REMIND_AFTER_DAYS = 14;

async function scheduleRestockReminder(orderId: string): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return false;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Ready to restock?",
      body: "Reorder your foodstuff from Eki in a couple of taps.",
      // Opens this order through the existing notification routing.
      data: { type: "buyer_order_delivered", orderId },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: REMIND_AFTER_DAYS * 24 * 60 * 60 },
  });
  return true;
}

/** Retention loop after a completed order (spec B, B25). */
export function RestockCard({ order }: { order: Order }) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const [preparing, setPreparing] = useState(false);

  const prepareBasket = async () => {
    setPreparing(true);
    const results = await Promise.allSettled(order.items.map((item) => addItem(item.product, item.quantity)));
    setPreparing(false);
    const added = results.filter((r) => r.status === "fulfilled").length;
    if (added === 0) {
      Alert.alert("Couldn't prepare your basket", "These items are no longer available to reorder.");
      return;
    }
    if (added < results.length) {
      Alert.alert("Some items are unavailable", `${added} of ${results.length} items were added to your basket.`);
    }
    router.push("/(buyer)/cart" as any);
  };

  const remindLater = async () => {
    try {
      const scheduled = await scheduleRestockReminder(order.id);
      Alert.alert(
        scheduled ? "Reminder set" : "Reminder not set",
        scheduled ? `We'll remind you in ${REMIND_AFTER_DAYS} days.` : "Turn on notifications for Eki to get a reminder.",
      );
    } catch {
      Alert.alert("Reminder not set", "Please try again.");
    }
  };

  const vendorId = order.items[0]?.product.vendorId;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Ready to restock?</Text>
      <TouchableOpacity onPress={() => void prepareBasket()} disabled={preparing} activeOpacity={0.86} style={[styles.primary, preparing && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel="Prepare basket" accessibilityState={{ busy: preparing, disabled: preparing }}>
        {preparing ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
          <>
            <Ionicons name="cart-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryText}>Prepare basket</Text>
          </>
        )}
      </TouchableOpacity>
      <RegularDeliveryEntry
        vendorId={vendorId}
        mode="product"
        items={order.items.map((item) => ({ productId: item.product.id, quantity: item.quantity }))}
      />
      <TouchableOpacity onPress={() => void remindLater()} activeOpacity={0.8} style={styles.secondary} accessibilityRole="button" accessibilityLabel="Remind me later">
        <Text style={styles.secondaryText}>Remind me later</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, marginBottom: 14 },
  title: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#12221A", marginBottom: 12 },
  primary: { height: 48, borderRadius: 14, backgroundColor: "#076B51", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryText: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  secondary: { alignSelf: "center", paddingVertical: 10, paddingHorizontal: 14 },
  secondaryText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
});
