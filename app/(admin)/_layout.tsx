import React from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_HEIGHT } from "../../components/layout/tabBarConstants";
import { useAuthStore } from "../../stores/authStore";

export default function AdminLayout() {
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
    return <Redirect href={{ pathname: "/(auth)/login", params: { role: "admin" } }} />;
  }

  if (role === "buyer") {
    return <Redirect href="/(buyer)" />;
  }

  if (role === "vendor") {
    return <Redirect href="/(vendor)" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#076B51",
        tabBarInactiveTintColor: "#9AA3A0",
        tabBarStyle: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: TAB_BAR_HEIGHT + Math.max(insets.bottom - 4, 0),
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 10),
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "#E8EAE9",
          borderRadius: 0,
          shadowColor: "#08140F",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.04,
          shadowRadius: 10,
          elevation: 10,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: "Manrope-SemiBold",
          marginTop: 3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Overview",
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="vendors"
        options={{
          title: "Vendors",
          tabBarIcon: ({ color, size }) => <Ionicons name="storefront-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, size }) => <Ionicons name="bag-handle-outline" size={size} color={color} />,
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
        name="analytics"
        options={{
          title: "Analytics",
          tabBarIcon: ({ color, size }) => <Ionicons name="pie-chart-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="disputes" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="buyers" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="reward-rules" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="settings" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="vendor-detail" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="create-message" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="message-chat" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="order-detail" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="dispute-detail" options={{ href: null, tabBarStyle: { display: "none" } }} />
    </Tabs>
  );
}
