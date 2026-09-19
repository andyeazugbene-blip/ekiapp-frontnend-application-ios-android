import { useEffect } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LoadingBlock, premiumStyles } from "../../components/shared/PremiumBlocks";
import { useAuthStore } from "../../stores/authStore";

/**
 * Universal/app-link destination for https://culinarytales.app/community-buy/:id
 * (declared in the backend's apple-app-site-association and in
 * getPublicCommunityBuyUrl()'s share links) — this route file was missing
 * entirely, so every shared Community Buy link 404'd as an Unmatched
 * Route once Universal Links handed the app a path with no matching
 * screen. Mirrors order/[id].tsx and product/[id].tsx's exact
 * thin-redirect pattern rather than becoming a second campaign-detail
 * screen: the real screen is (buyer)/community-buy-campaign, reachable to
 * any authenticated user regardless of role (Community Buy needs no
 * vendor capability — see role-select.tsx), so there is no role branch
 * to make here, unlike order/[id].tsx's buyer/vendor split.
 */
export default function CommunityBuyDeepLinkRedirect() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  useEffect(() => {
    const user = useAuthStore.getState().user;

    if (!user) {
      // Logged out — come back to this same deep link once signed in, so
      // it re-resolves to the campaign below instead of losing the id.
      router.replace({ pathname: "/(auth)/login", params: { redirect: id ? `/community-buy/${id}` : "/(buyer)/community-buy" } } as any);
      return;
    }

    if (!id) {
      router.replace("/(buyer)/community-buy" as any);
      return;
    }

    router.replace(`/(buyer)/community-buy-campaign?id=${id}` as any);
  }, [id, router]);

  return (
    <View style={premiumStyles.page}>
      <LoadingBlock />
    </View>
  );
}
