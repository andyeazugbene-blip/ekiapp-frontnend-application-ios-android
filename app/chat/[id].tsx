import { useEffect } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LoadingBlock, premiumStyles } from "../../components/shared/PremiumBlocks";
import { useAuthStore } from "../../stores/authStore";

/**
 * Universal/app-link destination for https://culinarytales.app/chat/:id.
 *
 * There is no URL-addressable conversation-detail screen in this app —
 * message-chat.tsx takes no route params at all and reads the active
 * conversation from messageStore's client-side selection. The one real,
 * existing "open a specific conversation" entry point is the messages
 * LIST screen's own ?conversationId= handling (app/(buyer)/messages.tsx,
 * app/(vendor)/messages.tsx) — the exact same destination
 * app/_layout.tsx's "new_message" notification tap already uses. This
 * redirect reuses that identical, already-built mechanism rather than
 * inventing a new conversation-detail route.
 *
 * Authorization: the list screen only ever loads the current user's own
 * conversations (loadConversations()), so if this id isn't one of theirs
 * it simply won't be found/auto-opened — no new access check is added or
 * needed here, and none is bypassed.
 */
export default function ChatDeepLinkRedirect() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  useEffect(() => {
    const user = useAuthStore.getState().user;

    if (!user) {
      router.replace({ pathname: "/(auth)/login", params: { redirect: id ? `/chat/${id}` : "/(buyer)" } } as any);
      return;
    }

    const base = user.role === "vendor" || user.role === "admin" ? "/(vendor)/messages" : "/(buyer)/messages";
    router.replace(id ? (`${base}?conversationId=${id}` as any) : (base as any));
  }, [id, router]);

  return (
    <View style={premiumStyles.page}>
      <LoadingBlock />
    </View>
  );
}
