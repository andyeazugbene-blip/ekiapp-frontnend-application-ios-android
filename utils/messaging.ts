import { useMessageStore } from "../stores/messageStore";

interface OpenConversationParams {
  participantId: string;
  orderId?: string;
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

  await useMessageStore.getState().selectConversation(conversation);
  return conversation;
}
