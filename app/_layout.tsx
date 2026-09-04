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

// Must be set before any notification arrives — runs at module init
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Show banner, play sound, update badge on both iOS and Android
    // when the app is in the foreground.
    const data = notification.request.content.data;
    if (__DEV__) {
      console.log("[Push] Foreground notification received:", {
        title: notification.request.content.title,
        body: notification.request.content.body,
        data,
      });
    }
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
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

  // Create notification channels (Android) and categories (iOS).
  // Must be done before any notification is received.
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
    if (Platform.OS === "ios") {
      // iOS notification categories allow notification actions and
      // ensure foreground alerts display correctly.
      Notifications.setNotificationCategoryAsync("default", [
        { identifier: "view", buttonTitle: "View", options: { opensAppToForeground: true } },
      ]).catch(() => {});
      Notifications.setNotificationCategoryAsync("orders", [
        { identifier: "view", buttonTitle: "View Order", options: { opensAppToForeground: true } },
      ]).catch(() => {});
      Notifications.setNotificationCategoryAsync("payouts", [
        { identifier: "view", buttonTitle: "View", options: { opensAppToForeground: true } },
      ]).catch(() => {});
      Notifications.setNotificationCategoryAsync("messages", [
        { identifier: "reply", buttonTitle: "Reply", options: { opensAppToForeground: true } },
      ]).catch(() => {});
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
    // Log foreground notifications for debugging
    const receivedSub = Notifications.addNotificationReceivedListener(notification => {
      if (__DEV__) {
        console.log("[Push] Notification received while app is in foreground:", {
          title: notification.request.content.title,
          body: notification.request.content.body,
          data: notification.request.content.data,
        });
      }
    });

    // Handle notification taps - deep link to relevant screen
    const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (!data) return;
      try {
        const router = require("expo-router").router;
        const type = data.type as string | undefined;

        if (type === "order_status" || type === "new_order") {
          if (data.orderId) {
            // Determine vendor vs buyer based on current role
            const role = useAuthStore.getState().user?.role;
            if (role === "vendor" || role === "admin") {
              router.push(`/(vendor)/order-detail?id=${data.orderId}`);
            } else {
              router.push(`/(buyer)/orders`);
            }
          }
        } else if (type === "order_paid" || type === "order_delivered") {
          router.push(`/(buyer)/orders`);
        } else if (type === "new_message") {
          const role = useAuthStore.getState().user?.role;
          const conversationId = data.conversationId as string | undefined;
          const base = role === "vendor" || role === "admin" ? "/(vendor)/messages" : "/(buyer)/messages";
          router.push(conversationId ? `${base}?conversationId=${conversationId}` : base);
        } else if (type === "earnings_released" || type === "payout_approved") {
          router.push(`/(vendor)/earnings`);
        } else if (type === "subscription_update") {
          const role = useAuthStore.getState().user?.role;
          const event = data.event as string | undefined;
          if (event === "vendor_renewal_paid") {
            router.push(`/(vendor)/regular-deliveries`);
          } else if (event === "order_created") {
            router.push(`/(buyer)/orders`);
          } else if (role === "vendor") {
            router.push(`/(vendor)/regular-deliveries`);
          } else {
            router.push(`/(buyer)/regular-deliveries`);
          }
        } else if (type === "community_campaign_update") {
          const event = data.event as string | undefined;
          const campaignId = data.campaignId as string | undefined;
          if (!campaignId) {
            router.push(`/(buyer)/community-buy`);
          } else if (event === "approved" || event === "changes_requested" || event === "rejected") {
            router.push(`/(buyer)/community-buy-organiser-campaign?id=${campaignId}`);
          } else {
            router.push(`/(buyer)/community-buy-campaign?id=${campaignId}`);
          }
        } else if (typeof type === "string" && type.startsWith("automation_")) {
          const role = useAuthStore.getState().user?.role;
          if (type === "automation_cart_recovery") {
            router.push(`/(buyer)/cart`);
          } else if (type === "automation_review_request") {
            router.push(`/(buyer)/orders`);
          } else if (type === "automation_buyer_referral") {
            router.push(`/(buyer)/invite-friend`);
          } else if (type === "automation_renewal_reminder" || type === "automation_price_approval_reminder") {
            router.push(`/(buyer)/regular-deliveries`);
          } else if (type === "automation_payment_recovery") {
            router.push(`/(buyer)/orders`);
          } else if (role === "vendor") {
            router.push(`/(vendor)/automation-center`);
          }
        } else if (type === "admin_broadcast") {
          // Default: no specific deep link for broadcasts
        }
      } catch {
        // Router not ready yet — ignore
      }
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
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
            <Stack.Screen name="refund-policy" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="cookie-policy" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="subscription-policy" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="acceptable-use" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="vendor-agreement" options={{ animation: "slide_from_right" }} />
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
