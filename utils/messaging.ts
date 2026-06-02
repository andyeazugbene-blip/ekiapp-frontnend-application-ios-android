import { useMessageStore } from "../stores/messageStore";

interface OpenConversationParams {
  participantId: string;
  orderId?: string;
  participantName?: string;
  participantAvatar?: string;
  participantRole?: "buyer" | "vendor" | "admin";
}

export async function openConversationThread(params: OpenConversationParams) {
  const store = useMessageStore.getState();

  await store.loadConversations().catch(() => undefined);

  const freshState = useMessageStore.getState();
  let conversation =
    freshState.conversations.find(
      (item) =>
        item.participantId === params.participantId &&
        (!params.orderId || item.orderId === params.orderId),
    ) ??
    freshState.conversations.find((item) => item.participantId === params.participantId) ??
    null;

  if (!conversation) {
    conversation = await freshState.createConversation(params.participantId, params.orderId);
  }

  const enrichedConversation = {
    ...conversation,
    participantName: params.participantName ?? conversation.participantName,
    participantAvatar: params.participantAvatar ?? conversation.participantAvatar,
    participantRole: params.participantRole ?? conversation.participantRole,
  };

  useMessageStore.setState((state) => ({
    conversations: state.conversations.map((item) =>
      item.id === enrichedConversation.id ? enrichedConversation : item,
    ),
  }));

  await useMessageStore.getState().selectConversation(enrichedConversation);
  return enrichedConversation;
}
