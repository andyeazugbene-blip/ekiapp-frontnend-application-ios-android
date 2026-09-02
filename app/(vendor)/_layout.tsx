import React from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, View as RNView } from "react-native";
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

  // Buyer without a vendor profile cannot access vendor area
  if (role === "buyer" && !hasVendor) {
    return <Redirect href="/(buyer)" />;
  }

  // Buyer with a vendor profile will have already been switched by the
  // login screen (switchRole called before navigation). If they somehow
  // arrive here with role=buyer+hasVendor (deep link, stale state), we
  // redirect them back to buyer instead of showing a broken layout.
  if (role === "buyer" && hasVendor) {
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
      <Tabs.Screen name="accept-order" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="mark-shipped" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="order-completed" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="upgrade-prompt" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="automation-center" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="regular-deliveries" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="regular-delivery-offer-edit" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="community-buy-supplier" options={{ href: null, tabBarStyle: { display: "none" } }} />
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
  color: string;
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
