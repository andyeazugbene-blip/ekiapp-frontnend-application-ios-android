import { useEffect } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LoadingBlock, premiumStyles } from "../../components/shared/PremiumBlocks";
import { useAuthStore } from "../../stores/authStore";

/**
 * Universal/app-link destination for https://culinarytales.app/invite/:code.
 *
 * There is no dedicated "accept invite" screen in this app. Referral
 * codes are consumed exactly once, at registration, by
 * referralsService.applyReferral() (backend) — app/(auth)/register.tsx
 * already accepts a ?ref= param to prefill its (manually editable)
 * referral code field. That is the one real, existing destination for
 * an incoming invite link; this redirect reuses it rather than
 * inventing a new screen.
 *
 * An already-logged-in user has no applicable action for an invite code
 * — the backend only attaches a referral at signup, and this codebase
 * has no post-registration redemption path. Sending them Home in that
 * case is not a stand-in for a missing chat/invite destination; it's the
 * honest outcome of a real, confirmed product limitation (there is
 * nothing else for them to do with the code), not a screen this redirect
 * invented.
 */
export default function InviteDeepLinkRedirect() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();

  useEffect(() => {
    const user = useAuthStore.getState().user;

    if (!user) {
      router.replace({ pathname: "/(auth)/register", params: code ? { ref: code } : {} } as any);
      return;
    }

    // Logged in already: no post-registration referral redemption exists.
    router.replace("/(buyer)" as any);
  }, [code, router]);

  return (
    <View style={premiumStyles.page}>
      <LoadingBlock />
    </View>
  );
}
