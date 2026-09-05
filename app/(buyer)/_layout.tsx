import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCartStore } from "../../stores/cartStore";
import { useAuthStore } from "../../stores/authStore";
import { TAB_BAR_HEIGHT, TAB_BAR_GAP } from "../../components/layout/tabBarConstants";

function CartBadge() {
  const items = useCartStore((s) => s.items);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  if (totalItems === 0) return null;
  return (
    <View style={{ position: "absolute", top: -3, right: -5, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#FB6363", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
      <Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "800" }}>{totalItems > 9 ? "9+" : totalItems}</Text>
    </View>
  );
}

export default function BuyerLayout() {
  const insets = useSafeAreaInsets();
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.user?.role);

  if (isInitializing) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F9F9F9" }}>
        <ActivityIndicator color="#076B51" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href={{ pathname: "/(auth)/login", params: { role: "buyer" } }} />;
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
          title: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="cart-outline" size={size} color={color} />
              <CartBadge />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: "Wallet",
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="explore" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="orders" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="profile" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="checkout" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="order-confirmation" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="product-detail" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="vendor-detail" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="message-chat" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="track-order" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="report-issue" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="delivery-unavailable" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="referral-program" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="invite-friend" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="reward-history" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="favorites" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="gift-card-detail" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="gift-cards" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="leave-review" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="deals" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="notifications" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="regular-deliveries" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="regular-deliveries-browse" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="regular-delivery-offer" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="regular-delivery-detail" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="community-buy" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="community-buy-campaign" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="community-buy-organiser" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="community-buy-organiser-campaign" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="my-community-buys" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="community-buy-support-cases" options={{ href: null, tabBarStyle: { display: "none" } }} />
    </Tabs>
  );
}
