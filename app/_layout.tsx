import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";
import * as Updates from "expo-updates";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { StripeProvider } from "../components/providers/StripeProvider";
import { useAuthStore } from "../stores/authStore";
import { resolveBroadcastLink } from "../utils/broadcastLink";
import { pushTokenService } from "../services/notificationService";
import { initMonitoring, wrapRootComponent } from "../services/monitoring";
import "../global.css";

// Initialized at module load, not inside an effect: the crash this was
// wired up to diagnose is thrown within ~4s of process launch, before the
// first effect would even run. Sentry must be live before then to catch it.
initMonitoring();

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

function RootLayout() {
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
    useAuthStore.getState().checkAuth().catch(() => {});
  }, []);

  // REVERTED (previous version called Updates.reloadAsync() here too —
  // that was a real regression, not a theoretical one: the background
  // check+fetch can resolve several seconds after launch, with NO way to
  // know whether the user has since started doing something (like
  // logging in). reloadAsync() tears down the entire JS runtime
  // immediately and unconditionally the moment it resolves — mid-login,
  // that reads as "the app kicks me out and I can't sign in", exactly
  // what got reported. Pre-fetching in the background is still safe and
  // still helps (the update is ready sooner), but APPLYING it stays on
  // the normal, safe trigger: the next time the user actually chooses to
  // close and reopen the app, never a surprise mid-session teardown.
  // Root cause of the reported crash found 19 Oct 2026 from a real device
  // .ips: it's expo-updates' own built-in native "Error Recovery" feature
  // (EXUpdatesErrorRecovery), not this effect. That mechanism intercepts
  // ANY fatal JS error thrown within ~10s of launch, independently checks
  // for a fix-forward OTA update, and — per Expo's own docs — deliberately
  // RE-THROWS the original error and crashes if no fix arrives in time.
  // The crashing thread was literally named "expo.controller.
  // errorRecoveryQueue", confirming this. Expo's documented mitigation is
  // "make sure the app checks for updates right after launch" — the exact
  // opposite of disabling this effect, so it stays on. The real unresolved
  // problem is whatever fatal JS error is being thrown during early launch
  // in the first place; this effect was never it.
  useEffect(() => {
    if (!Updates.isEnabled) return;
    (async () => {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (!result.isAvailable) return;
        await Updates.fetchUpdateAsync();
      } catch {
        // No network, update server unreachable, etc. — the app keeps
        // running on whatever version is already active.
      }
    })();
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

    // Handle notification taps - deep link to relevant screen. Shared by
    // both the live listener below (tap while the app is already running)
    // and getLastNotificationResponseAsync() (tap that COLD-STARTED the
    // app from fully killed) — addNotificationResponseReceivedListener
    // alone can race a cold start, since the native side may record the
    // tap before this listener is even attached. Both paths can report the
    // same response, so handleNotificationTap deduplicates by request and
    // action identifier before navigating.
    const handledTapIds = new Set<string>();
    const handleNotificationTap = (
      data: Record<string, unknown> | null | undefined,
      tapId?: string,
    ) => {
      if (!data) return;
      if (tapId) {
        if (handledTapIds.has(tapId)) return;
        handledTapIds.add(tapId);
        // Keep the in-memory guard bounded for long-running app sessions.
        if (handledTapIds.size > 50) {
          const oldestTapId = handledTapIds.values().next().value;
          if (oldestTapId) handledTapIds.delete(oldestTapId);
        }
      }
      try {
        const router = require("expo-router").router;
        const type = data.type as string | undefined;
        const destination = data.destination as string | undefined;

        if (destination) {
          const role = useAuthStore.getState().user?.role;
          const param = (...keys: string[]) => {
            for (const key of keys) {
              const value = data[key];
              if (typeof value === "string" && value.trim()) return encodeURIComponent(value);
            }
            return undefined;
          };
          const productId = param("productId", "id");
          const orderId = param("orderId", "id");
          const campaignId = param("campaignId", "id");
          const subscriptionId = param("subscriptionId", "foodstuffSubscriptionId", "id");

          if (destination === "store_setup" && role === "vendor") {
            router.push("/(vendor-onboarding)/setup-store");
          } else if (destination === "foodstuff_editor" && role === "vendor") {
            router.push(productId ? `/(vendor)/foodstuff-edit?id=${productId}` : "/(vendor)/foodstuff-add");
          } else if (destination === "verification" && role === "vendor") {
            router.push("/(vendor-verification)/index");
          } else if (destination === "inventory_detail" && role === "vendor") {
            router.push(productId ? `/(vendor)/foodstuff-detail?id=${productId}` : "/(vendor)/foodstuff?filter=low_stock");
          } else if (destination === "order_detail" && orderId) {
            if (role === "admin") router.push(`/(admin)/order-detail?id=${orderId}`);
            else if (role === "vendor") router.push(`/(vendor)/order-detail?id=${orderId}`);
            else if (role === "buyer") router.push(`/(buyer)/track-order?id=${orderId}`);
          } else if (destination === "order_detail") {
            if (role === "admin") router.push("/(admin)/orders");
            else if (role === "vendor") router.push("/(vendor)/orders");
            else if (role === "buyer") router.push("/(buyer)/orders");
          } else if (destination === "store_share" && role === "vendor") {
            router.push("/(vendor)/share-store-link");
          } else if (destination === "first_sale" && role === "vendor") {
            router.push("/(vendor)/grow-sales");
          } else if (destination === "automation_detail" && role === "vendor") {
            const automationType = param("automationType", "type");
            router.push(automationType ? `/(vendor)/automation-detail?type=${automationType}` : "/(vendor)/automation-center");
          } else if (destination === "checkout" && role === "buyer") {
            router.push("/(buyer)/checkout");
          } else if (destination === "foodstuff_subscription" && role === "buyer") {
            router.push(subscriptionId ? `/(buyer)/regular-delivery-detail?id=${subscriptionId}` : "/(buyer)/regular-deliveries");
          } else if (destination === "community_buy_campaign" && campaignId) {
            const audience = data.audience;
            if (audience === "supplier") router.push(`/(supplier)/community-buy-supplier-fulfilment?id=${campaignId}`);
            else if (role === "buyer" && audience === "organiser") router.push(`/(buyer)/community-buy-organiser-campaign?id=${campaignId}`);
            else if (role === "buyer") router.push(`/(buyer)/community-buy-campaign?id=${campaignId}`);
          } else if (destination === "community_buy_campaign" && role === "buyer") {
            router.push("/(buyer)/community-buy");
          } else if (destination === "community_buy_campaign" && data.audience === "supplier") {
            router.push("/(supplier)/community-buy-supplier");
          } else if (destination === "membership" && role === "vendor") {
            router.push("/(vendor)/subscription-plans");
          } else if (destination === "referral_rewards" && role === "buyer") {
            router.push("/(buyer)/referral-program");
          } else if (destination === "support_case" && role === "buyer") {
            const supportCampaignId = param("campaignId");
            router.push(supportCampaignId
              ? `/(buyer)/community-buy-support-cases?campaignId=${supportCampaignId}`
              : "/(buyer)/contact-support");
          } else if (destination === "admin_case" && role === "admin" && data.event === "critical_payment_anomaly") {
            const anomalyKey = param("anomalyKey");
            router.push(anomalyKey
              ? `/(admin)/payment-anomalies?anomalyKey=${anomalyKey}`
              : "/(admin)/payment-anomalies");
          }
          // A semantic key is authoritative: when its role or required
          // resource is missing, do not fall through to an unrelated route.
          return;
        }

        if (
          type === "order_status" || type === "new_order" ||
          // P0 fix: these previously had no frontend branch at all (dead
          // taps) — buyer_order_shipped/delivered and vendor_first_order
          // all resolve to the same order-detail/track-order destination
          // this branch already computes correctly per-role; only
          // buyer_order_confirmed is defensive (see stripe.service.ts —
          // it is not currently ever sent as a push/in-app notification,
          // only logged for the admin Communications page, but is routed
          // here too in case that ever changes).
          type === "buyer_order_shipped" || type === "buyer_order_delivered" ||
          type === "buyer_order_confirmed" || type === "vendor_first_order"
        ) {
          if (data.orderId) {
            // Determine vendor vs buyer based on current role
            const role = useAuthStore.getState().user?.role;
            if (role === "vendor" || role === "admin") {
              router.push(`/(vendor)/order-detail?id=${data.orderId}`);
            } else {
              router.push(`/(buyer)/track-order?id=${data.orderId}`);
            }
          } else {
            const role = useAuthStore.getState().user?.role;
            router.push(role === "vendor" || role === "admin" ? `/(vendor)/orders` : `/(buyer)/orders`);
          }
        } else if (type === "order_paid" || type === "order_delivered") {
          const orderId = data.orderId as string | undefined;
          const role = useAuthStore.getState().user?.role;
          if (role === "vendor" || role === "admin") {
            router.push(orderId ? `/(vendor)/order-detail?id=${orderId}` : `/(vendor)/orders`);
          } else {
            router.push(orderId ? `/(buyer)/track-order?id=${orderId}` : `/(buyer)/orders`);
          }
        } else if (type === "order_refunded") {
          // orderIds is an array — a refund can span every order under one
          // checkout. A single refunded order deep-links exactly; more than
          // one has no single detail screen to land on, so the orders list
          // (where each shows its real REFUNDED status) is the correct
          // target, not a wrong guess at which one to open.
          const orderIds = data.orderIds as string[] | undefined;
          const role = useAuthStore.getState().user?.role;
          if (role === "vendor" || role === "admin") {
            router.push(orderIds?.length === 1 ? `/(vendor)/order-detail?id=${orderIds[0]}` : `/(vendor)/orders`);
          } else {
            router.push(orderIds?.length === 1 ? `/(buyer)/track-order?id=${orderIds[0]}` : `/(buyer)/orders`);
          }
        } else if (type === "new_message") {
          const role = useAuthStore.getState().user?.role;
          const conversationId = data.conversationId as string | undefined;
          const base = role === "vendor" || role === "admin" ? "/(vendor)/messages" : "/(buyer)/messages";
          router.push(conversationId ? `${base}?conversationId=${conversationId}` : base);
        } else if (type === "earnings_released") {
          const role = useAuthStore.getState().user?.role;
          router.push(role === "vendor" || role === "admin" ? `/(vendor)/earnings` : `/(buyer)`);
        } else if (
          // NAV-04 fix: these previously had no frontend branch at all (dead
          // taps) — payouts.service.ts now sets data.type on all 4 payout
          // lifecycle notifications. The payout-history list (not a
          // per-payout detail screen, which doesn't exist) is the correct
          // destination — it already renders each request's live status.
          type === "payout_requested" || type === "payout_approved" ||
          type === "payout_rejected" || type === "payout_paid"
        ) {
          const role = useAuthStore.getState().user?.role;
          router.push(role === "vendor" || role === "admin" ? `/(vendor)/payout-history` : `/(buyer)`);
        } else if (type === "subscription_update") {
          const role = useAuthStore.getState().user?.role;
          const event = data.event as string | undefined;
          const subscriptionId = data.subscriptionId as string | undefined;
          if (event === "vendor_renewal_paid") {
            router.push(`/(vendor)/regular-deliveries`);
          } else if (event === "vendor_price_decision") {
            // Vendor-targeted (see notifyVendorPriceDecision, backend repo)
            // — must not fall into the buyer-only regular-delivery-detail
            // branch below just because subscriptionId is present.
            router.push(subscriptionId ? `/(vendor)/regular-delivery-subscriber-detail?id=${subscriptionId}` : `/(vendor)/regular-deliveries`);
          } else if (event === "order_created") {
            router.push(`/(buyer)/orders`);
          } else if (subscriptionId) {
            // price_approval_required, payment_failed, renewal_cancelled,
            // price_approval_expired — all real, per-subscription events
            // that previously always opened the generic list instead of
            // the specific subscription the notification was actually about.
            router.push(`/(buyer)/regular-delivery-detail?id=${subscriptionId}`);
          } else if (role === "vendor") {
            router.push(`/(vendor)/regular-deliveries`);
          } else {
            router.push(`/(buyer)/regular-deliveries`);
          }
        } else if (type === "community_campaign_update") {
          const event = data.event as string | undefined;
          const campaignId = data.campaignId as string | undefined;
          // NAV-08 fix: admin_cancelled/cancelled/rescue_opened/
          // extension_approved/succeeded/failed/fulfilment_update all fire
          // under the SAME event name to both the organiser and every
          // participant (an organiser is just a buyer-role account, so role
          // can't disambiguate) — community-campaigns.service.ts and
          // campaign-fulfilment.service.ts now tag the organiser's own copy
          // with data.audience:"organiser"; participants get no such field
          // and correctly fall through to the participant screen below.
          // supplier_declined has no participant-side call at all, so it's
          // unambiguous by event name alone, same as the 5 pre-existing ones.
          if (!campaignId) {
            router.push(`/(buyer)/community-buy`);
          } else if (
            event === "approved" || event === "changes_requested" || event === "rejected" ||
            event === "supplier_accepted" || event === "inventory_confirmed" ||
            event === "supplier_declined" || data.audience === "organiser"
          ) {
            router.push(`/(buyer)/community-buy-organiser-campaign?id=${campaignId}`);
          } else if (event === "supplier_invited") {
            // Supplier-facing, not organiser/participant — the supplier's
            // assigned-campaigns screen (its own independent route group,
            // not nested under vendor), not the buyer-side campaign detail
            // this event has nothing to do with.
            router.push(`/(supplier)/community-buy-supplier`);
          } else if (
            // M9 fix — these six payout-lifecycle events (campaign-payout.
            // service.ts's notifySupplier) and the fulfilment-follow-up
            // alert (fulfilment-delay.service.ts) are ALL sent to the
            // SUPPLIER, never the participant. Before this fix they fell
            // through to the participant campaign-detail screen below,
            // which has no payout/fulfilment-delay content for a supplier
            // to act on — a dead-feeling deep link, not just a suboptimal one.
            event === "payout_ready" || event === "payout_held" || event === "payout_initiated" ||
            event === "payout_in_transit" || event === "payout_paid" || event === "payout_failed" ||
            event === "fulfilment_follow_up"
          ) {
            router.push(`/(supplier)/community-buy-supplier-fulfilment?id=${campaignId}`);
          } else if (event === "emergency_disclosure_granted") {
            // Also supplier-facing (admin-approvals.controller.ts grants
            // this TO the assigned supplier) — the fulfilment screen is
            // where the disclosed contact detail is actually surfaced.
            router.push(`/(supplier)/community-buy-supplier-fulfilment?id=${campaignId}`);
          } else if (event === "supplier_invitation") {
            // Workstream 3 (mandate item 7) — a real, token-based invitation,
            // distinct from supplier_invited above (which fires only when
            // the organiser assigns an already-approved supplier). Routes to
            // the public accept/decline screen even for an already-logged-in
            // existing user, since accepting/declining is still per-token.
            const token = data.token as string | undefined;
            if (token) router.push(`/supplier-invitation/${token}`);
          } else {
            router.push(`/(buyer)/community-buy-campaign?id=${campaignId}`);
          }
        } else if (typeof type === "string" && type.startsWith("automation_")) {
          const role = useAuthStore.getState().user?.role;
          const campaignId = data.campaignId as string | undefined;
          if (type === "automation_registration_reminder" && role === "vendor") {
            // R01 is sent before a Vendor profile exists, so use the
            // authenticated vendor's own store-setup flow.
            router.push(`/(vendor-onboarding)/setup-store`);
          } else if (type === "automation_first_product_reminder" && role === "vendor") {
            // R03 has no product id by definition; open the vendor's
            // create-product screen rather than passing a guessed id.
            router.push(`/(vendor)/foodstuff-add`);
          } else if (type === "automation_delivery_setup_reminder" && role === "vendor") {
            router.push(`/(vendor)/delivery`);
          } else if (type === "automation_verification_reminder" && role === "vendor") {
            router.push(`/(vendor-verification)/index`);
          } else if (type === "automation_low_stock_alert" && role === "vendor") {
            // The backend payload is a product count, not product ids.
            // Filter the authenticated vendor's inventory instead of
            // constructing a detail URL for an unknown product.
            router.push(`/(vendor)/foodstuff?filter=low_stock`);
          } else if (type === "automation_first_sale" && role === "vendor") {
            // There is no dedicated first-sale campaign screen in mobile;
            // Grow Sales is the existing vendor campaign and promotion hub.
            router.push(`/(vendor)/grow-sales`);
          } else if (type === "automation_store_share_reminder" && role === "vendor") {
            // R10: land on the actual vendor share flow. The screen is
            // inside the vendor route group and uses the signed-in vendor's
            // own profile; other roles must not be sent into that group.
            router.push(`/(vendor)/share-store-link`);
          } else if (type === "automation_cart_recovery") {
            router.push(`/(buyer)/cart`);
          } else if (type === "automation_review_request") {
            router.push(`/(buyer)/orders`);
          } else if (type === "automation_buyer_referral") {
            router.push(`/(buyer)/invite-friend`);
          } else if (type === "automation_renewal_reminder" || type === "automation_price_approval_reminder") {
            router.push(`/(buyer)/regular-deliveries`);
          } else if (type === "automation_payment_recovery") {
            router.push(`/(buyer)/orders`);
          } else if (type === "automation_campaign_deadline") {
            // NAV-10 fix: previously a dead tap for buyers, with no id even
            // if a branch existed — community-campaigns.service.ts now
            // includes campaignId in this automation's data payload.
            router.push(campaignId ? `/(buyer)/community-buy-campaign?id=${campaignId}` : `/(buyer)/community-buy`);
          } else if (type === "automation_buyer_win_back") {
            // NAV-10 fix: no entity id applies here (a general "come back"
            // nudge, not tied to one order/product) — Home is the correct,
            // static destination, same pattern as vendor_verification_approved.
            router.push(`/(buyer)`);
          } else if (role === "vendor") {
            router.push(`/(vendor)/automation-center`);
          } else {
            // NAV-10 fix: previously a silent no-op for any buyer-recipient
            // automation type with no matching branch above — including
            // automation_campaign_milestone/automation_campaign_refund_update,
            // which can no longer even fire (NOTIF-DUP-01, P1-1, removed
            // their only trigger) but are kept here as a safety net rather
            // than assumed permanently unreachable.
            router.push(`/(buyer)`);
          }
        } else if (type === "regular_delivery_frequency_changed") {
          // QA gate fix: buyerSubscriptionsService.changeFrequency()/
          // adminChangeFrequency() (Final Client Decision 3) send this with
          // a real subscriptionId, but no frontend branch existed at all —
          // a dead tap on a just-shipped, client-approved feature.
          const subscriptionId = data.subscriptionId as string | undefined;
          router.push(subscriptionId ? `/(buyer)/regular-delivery-detail?id=${subscriptionId}` : `/(buyer)/regular-deliveries`);
        } else if (type === "low_stock") {
          // Legacy low-stock pushes have no product id either.
          const role = useAuthStore.getState().user?.role;
          if (role === "vendor") router.push(`/(vendor)/foodstuff?filter=low_stock`);
        } else if (type === "support_case_response") {
          // NOTIF-08 fix: previously no notification was ever sent for this
          // event at all. No per-case detail screen exists — the real,
          // already-supported destination is the support-cases list
          // filtered to this campaign (community-buy-campaign.tsx already
          // navigates here with campaignId the same way for a self-service
          // "report issue" tap).
          const campaignId = data.campaignId as string | undefined;
          router.push(campaignId ? `/(buyer)/community-buy-support-cases?campaignId=${campaignId}` : `/(buyer)/community-buy-support-cases`);
        } else if (type === "vendor_verification_approved") {
          // P0 fix: previously unrecognized — dead tap. Static destination,
          // no id needed (a vendor has exactly one verification status).
          router.push(`/(vendor-verification)/approved`);
        } else if (type === "vendor_verification_rejected") {
          router.push(`/(vendor-verification)/rejected`);
        } else if (type === "admin_broadcast" || type === "admin_broadcast_test") {
          // Admin Communication Center broadcast: open the allow-listed route it carries (data.link), if any.
          const link = resolveBroadcastLink(data, useAuthStore.getState().user?.role);
          if (link) router.push(link as any);
        }
      } catch {
        // Router not ready yet — ignore
      }
    };

    const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
      const tapId = `${response.notification.request.identifier}:${response.actionIdentifier}`;
      handleNotificationTap(response.notification.request.content.data, tapId);
    });

    // Cold start: the app was fully killed and the user tapped a
    // notification to launch it. getLastNotificationResponseAsync() is
    // Expo's documented way to retrieve that tap — the live listener above
    // is not guaranteed to fire for it, since native can record the
    // response before this listener is attached.
    Notifications.getLastNotificationResponseAsync()
      .then(response => {
        if (response) {
          const tapId = `${response.notification.request.identifier}:${response.actionIdentifier}`;
          handleNotificationTap(response.notification.request.content.data, tapId);
        }
      })
      .catch(() => {});

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
            <Stack.Screen name="(supplier)" />
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
            <Stack.Screen name="product/[id]" />
            <Stack.Screen name="order/[id]" />
            <Stack.Screen name="chat/[id]" />
            <Stack.Screen name="invite/[code]" />
            <Stack.Screen name="supplier-invitation/[token]" options={{ animation: "slide_from_right" }} />
          </Stack>
        </StripeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

export default wrapRootComponent(RootLayout);
