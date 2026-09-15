import React from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "../../stores/authStore";

/**
 * Supplier Centre — an independent SupplierAccount capability (Workstream
 * 1/3), not a sub-feature of Vendor. It used to live under (vendor), gated
 * by hasVendor — that blocked an approved SupplierAccount user with no
 * Vendor row at all, and even for a Vendor+SupplierAccount user it wrapped
 * the screen in Vendor's own Tabs chrome (Dashboard/Orders/Foodstuff/
 * Buyers/Earnings), making an explicitly-chosen Supplier destination still
 * look and feel like Vendor.
 *
 * This layout only requires authentication — no hasVendor, no role check.
 * The backend is the actual authority: it already accepts any authenticated
 * user for the profile/apply endpoints (Workstream 1/3), and every deeper
 * action (accept a campaign, manage fulfilment) is independently checked
 * server-side against the caller's own SupplierAccount. A bare Stack (not
 * Tabs) means no tab-bar chrome from any other route group leaks in here.
 */
export default function SupplierLayout() {
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

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
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="community-buy-supplier" />
      <Stack.Screen name="community-buy-supplier-fulfilment" />
    </Stack>
  );
}
