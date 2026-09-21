import React from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ColorValue, Platform, StyleSheet, View as RNView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_HEIGHT, TAB_BAR_GAP } from "../../components/layout/tabBarConstants";
import { useAuthStore } from "../../stores/authStore";

export default function VendorLayout() {
  const insets = useSafeAreaInsets();
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.user?.role);
  const hasVendor = useAuthStore((s) => s.user?.hasVendor === true);

  if (isInitializing) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F9F9F9" }}>
        <ActivityIndicator color="#076B51" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href={{ pathname: "/(auth)/login", params: { role: "vendor" } }} />;
  }

  // Community Buy Workstream 1: gate on capability (a real Vendor row),
  // not on role — opening a store no longer flips role away from
  // "buyer" (backend vendors.service.ts createVendor), so this used to
  // bounce a buyer-with-a-store back to /(buyer) unless something had
  // pre-emptively called switchRole() first (the exact bug patched
  // earlier this session in role-select.tsx/(buyer)/index.tsx). No store
  // at all is still the only real reason to keep someone out. Supplier
  // Centre used to live here with a hasVendor bypass — real-device testing
  // showed that still left it wrapped in this Tabs navigator's own chrome
  // for a Vendor+SupplierAccount user, so it now lives in its own
  // independent route group (app/(supplier)/) instead of being special-
  // cased here at all.
  if (!hasVendor) {
    return <Redirect href="/(buyer)" />;
  }

  if (role === "admin") {
    return <Redirect href="/(admin)" />;
  }

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#076B51",
        tabBarInactiveTintColor: "#9AA3A0",
        tabBarStyle: {
          position: "absolute",
          left: 14,
          right: 14,
          bottom: Math.max(insets.bottom, TAB_BAR_GAP),
          height: TAB_BAR_HEIGHT,
          paddingTop: 8,
          paddingBottom: 8,
          backgroundColor: "#FFFFFF",
          borderTopWidth: 0,
          borderRadius: 24,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.12,
          shadowRadius: 18,
          elevation: 14,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: "Manrope-Bold",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} name="grid" outline="grid-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} name="bag-handle" outline="bag-handle-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="foodstuff"
        options={{
          title: "Foodstuff",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} name="cart" outline="cart-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="buyers"
        options={{
          title: "Buyers",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} name="people" outline="people-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: "Earnings",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} name="wallet" outline="wallet-outline" />
          ),
        }}
      />

      <Tabs.Screen name="messages" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="settings" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="edit-store-profile" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="edit-personal-profile" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="markets" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="activation" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="buyers-profile" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="analytics" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="grow-sales" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="coupon-history" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="create-discount" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="create-bundle" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="bundle-history" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="create-flash-sale" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="flash-sale-history" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="send-offer" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="promo-link" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="share-store-link" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="payout-mode" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="withdraw-payout" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="payout-requested" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="payout-history" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="subscription-plans" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="escrow-guide" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="plan-free" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="plan-growth" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="plan-pro" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="payment-details" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="plan-active" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="paywall-limit" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="foodstuff-detail" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="foodstuff-add" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="foodstuff-edit" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="delivery" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="delivery-zone" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="delivery-tracking" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="order-detail" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="message-chat" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="notifications" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="publish-check" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="mark-shipped" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="order-completed" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="upgrade-prompt" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="automation-center" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="automation-detail" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="automation-activity" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="notification-permission" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="regular-deliveries" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="regular-delivery-offer-edit" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="regular-delivery-subscriber-detail" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="regular-delivery-insights" options={{ href: null, tabBarStyle: { display: "none" } }} />
    </Tabs>
  );
}

function TabIcon({
  focused,
  color,
  name,
  outline,
}: {
  focused: boolean;
  color: ColorValue;
  name: keyof typeof Ionicons.glyphMap;
  outline: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <RNView style={iconStyles.wrap}>
      <Ionicons name={focused ? name : outline} size={22} color={color} />
      {focused ? <RNView style={[iconStyles.dot, { backgroundColor: color }]} /> : null}
    </RNView>
  );
}

const iconStyles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 26,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: Platform.OS === "ios" ? 2 : 1,
  },
});
