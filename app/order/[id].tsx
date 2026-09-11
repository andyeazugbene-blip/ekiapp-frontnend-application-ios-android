import { useEffect } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LoadingBlock, premiumStyles } from "../../components/shared/PremiumBlocks";
import { useAuthStore } from "../../stores/authStore";

/**
 * Universal/app-link destination for https://culinarytales.app/order/:id
 * (declared in app.json's Android intentFilters / iOS associatedDomains).
 *
 * Deliberately a thin redirect, not a new screen: reuses the exact same
 * role-aware destination app/_layout.tsx's notification tap handler
 * already uses for order events (order-detail for vendor/admin,
 * track-order for buyer) — the two real order-detail screens that exist.
 * Never trusts the URL's id beyond passing it through; both target
 * screens fetch the order from the backend, which enforces real
 * ownership (a buyer/vendor cannot see an order that isn't theirs).
 */
export default function OrderDeepLinkRedirect() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  useEffect(() => {
    const user = useAuthStore.getState().user;

    if (!user) {
      // Logged out — reuse the existing login redirect param rather than
      // inventing a new auth gate. Comes back to this same link once
      // signed in, which then resolves to the correct role-based screen.
      router.replace({ pathname: "/(auth)/login", params: { redirect: id ? `/order/${id}` : "/(buyer)" } } as any);
      return;
    }

    if (!id) {
      router.replace(user.role === "vendor" || user.role === "admin" ? "/(vendor)/orders" : "/(buyer)/orders");
      return;
    }

    if (user.role === "vendor" || user.role === "admin") {
      router.replace(`/(vendor)/order-detail?id=${id}` as any);
    } else {
      router.replace(`/(buyer)/track-order?id=${id}` as any);
    }
  }, [id, router]);

  return (
    <View style={premiumStyles.page}>
      <LoadingBlock />
    </View>
  );
}
