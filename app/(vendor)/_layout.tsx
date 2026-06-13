import React, { useEffect, useState } from "react";
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
  const switchRole = useAuthStore((s) => s.switchRole);

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

  // Buyer who has a vendor profile: auto-switch role instead of redirecting
  if (role === "buyer" && hasVendor) {
    // Fire switchRole and render a loading state until it completes
    // This runs once when the effect mounts
    return <AutoSwitchRole switchRole={switchRole} />;
  }

  if (role === "buyer") {
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
          title: "Product",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} name="basket" outline="basket-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="buyers"
        options={{
          href: null,
          title: "Buyers",
          tabBarStyle: { display: "none" },
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} name="people" outline="people-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Inbox",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} name="chatbubbles" outline="chatbubbles-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} name="settings" outline="settings-outline" />
          ),
        }}
      />

      <Tabs.Screen name="edit-store-profile" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="earnings" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="activation" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="buyers-profile" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="analytics" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="grow-sales" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="coupon-history" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="create-discount" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="create-bundle" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="create-flash-sale" options={{ href: null, tabBarStyle: { display: "none" } }} />
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

/**
 * Renders a loading screen and calls switchRole once.
 * Once the role flips from "buyer" to "vendor", the layout re-renders
 * and shows the vendor tabs instead of this component.
 */
function AutoSwitchRole({ switchRole }: { switchRole: () => Promise<void> }) {
  const [retried, setRetried] = useState(0);
  const role = useAuthStore((s) => s.user?.role);

  useEffect(() => {
    if (role === "vendor" || retried > 3) return;
    switchRole().catch(() => {
      setTimeout(() => setRetried((r) => r + 1), 500);
    });
  }, [switchRole, role, retried]);

  if (role === "vendor") return null;

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F9F9F9" }}>
      <ActivityIndicator color="#076B51" size="large" />
    </View>
  );
}
