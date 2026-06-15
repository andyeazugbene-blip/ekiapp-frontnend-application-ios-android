import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { StripeProvider } from "../components/providers/StripeProvider";
import { useAuthStore } from "../stores/authStore";
import { pushTokenService } from "../services/notificationService";
import { initMonitoring } from "../services/monitoring";
import "../global.css";
// Must be set at app root — not only in login flow
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "JosefinSans-Bold": require("../assets/fonts/JosefinSans-Bold.ttf"),
    "JosefinSans-Medium": require("../assets/fonts/JosefinSans-Medium.ttf"),
    "JosefinSans-Regular": require("../assets/fonts/JosefinSans-Regular.ttf"),
    "JosefinSans-SemiBold": require("../assets/fonts/JosefinSans-SemiBold.ttf"),
    "Manrope-Bold": require("../assets/fonts/Manrope-Bold.ttf"),
    "Manrope-ExtraBold": require("../assets/fonts/Manrope-ExtraBold.ttf"),
    "Manrope-Medium": require("../assets/fonts/Manrope-Medium.ttf"),
    "Manrope-Regular": require("../assets/fonts/Manrope-Regular.ttf"),
    "Manrope-SemiBold": require("../assets/fonts/Manrope-SemiBold.ttf"),
    "Outfit-Light": require("../assets/fonts/Outfit-Light.ttf"),
    "Outfit-Medium": require("../assets/fonts/Outfit-Medium.ttf"),
    "Outfit-Regular": require("../assets/fonts/Outfit-Regular.ttf"),
  });

  useEffect(() => {
    initMonitoring();
    useAuthStore.getState().checkAuth().catch(() => {});
  }, []);

  // Create Android notification channels (required for Android 8+)
  useEffect(() => {
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "General",
        importance: Notifications.AndroidImportance?.HIGH ?? 4,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#076B51",
      }).catch(() => {});
      Notifications.setNotificationChannelAsync("orders", {
        name: "Orders",
        importance: Notifications.AndroidImportance?.HIGH ?? 4,
      }).catch(() => {});
      Notifications.setNotificationChannelAsync("payouts", {
        name: "Payouts",
        importance: Notifications.AndroidImportance?.HIGH ?? 4,
      }).catch(() => {});
      Notifications.setNotificationChannelAsync("messages", {
        name: "Messages",
        importance: Notifications.AndroidImportance?.HIGH ?? 4,
      }).catch(() => {});
    }
  }, []);

  // Register push token on app start (not just on login)
  // Handles TestFlight updates where push token may change
  useEffect(() => {
    const state = useAuthStore.getState();
    if (state.isAuthenticated && !state.isInitializing && state.user) {
      pushTokenService.registerPushToken().catch(() => {});
    }
    const unsub = useAuthStore.subscribe((state) => {
      if (state.isAuthenticated && !state.isInitializing && state.user) {
        pushTokenService.registerPushToken().catch(() => {});
      }
    });
    return () => unsub();
  }, []);


  useEffect(() => {
    // Handle notification taps - deep link to relevant screen
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.orderId) {
        // Navigate to the appropriate order detail screen
        // This will work when expo-router is ready
        try {
          const router = require("expo-router").router;
          if (data.type === "new_order" || data.type === "order_status") {
            router.push(`/(vendor)/order-detail?id=${data.orderId}`);
          } else if (data.type === "order_paid") {
            router.push(`/(buyer)/orders`);
          } else if (data.type === "new_message") {
            router.push(`/(vendor)/messages`);
          }
        } catch {}
      }
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F4F4" }}>
        <ActivityIndicator size="small" color="#076B51" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <StripeProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(buyer)" />
            <Stack.Screen name="(vendor)" />
            <Stack.Screen name="(admin)" />
            <Stack.Screen name="terms" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="privacy" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="support" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="how-eki-works" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="vendor/subscription" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="(vendor-onboarding)" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="(vendor-verification)" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="store/[slug]" options={{ animation: "slide_from_right" }} />
          </Stack>
        </StripeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
