import { create } from "zustand";
import { messageService, Conversation, Message, type SendMessageInput } from "../services/messageService";
import { useAuthStore } from "./authStore";

// ─── Re-export types for backward compat ───────────────────────────────────────
export type { Conversation, Message };
export type ChatMessage = Message;

// ─── Polling interval ──────────────────────────────────────────────────────────
const POLL_INTERVAL = 7000; // 7 seconds

function sortMessages(messages: Message[]): Message[] {
  return [...messages].sort((a, b) => {
    const left = Date.parse(a.createdAt);
    const right = Date.parse(b.createdAt);
    if (Number.isFinite(left) && Number.isFinite(right)) return left - right;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

function mergeMessages(primary: Message[], secondary: Message[]): Message[] {
  const byId = new Map<string, Message>();
  [...secondary, ...primary].forEach((message) => {
    if (!message?.id) return;
    byId.set(message.id, message);
  });
  return sortMessages(Array.from(byId.values()));
}

// ─── Store ─────────────────────────────────────────────────────────────────────

interface MessageStore {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  isSending: boolean;
  pollingId: ReturnType<typeof setInterval> | null;

  // Actions
  loadConversations: () => Promise<void>;
  selectConversation: (conv: Conversation) => Promise<void>;
  sendMessage: (conversationId: string, input: string | (SendMessageInput & { localImageUri?: string })) => Promise<void>;
  startPolling: (conversationId: string) => void;
  stopPolling: () => void;
  markRead: (conversationId: string) => void;
  createConversation: (participantId: string, orderId?: string) => Promise<Conversation>;

  // Legacy compat
  setSelectedConversation: (conv: Conversation | null) => void;
  getMessages: (conversationId: string) => ChatMessage[];
  localMessages: Record<string, ChatMessage[]>;
}

export const useMessageStore = create<MessageStore>((set, get) => ({
  conversations: [],
  selectedConversation: null,
  messages: [],
  isLoading: false,
  isSending: false,
  pollingId: null,
  localMessages: {},

  loadConversations: async () => {
    set({ isLoading: true });
    try {
      const conversations = await messageService.getConversations();
      const localMessages = get().localMessages;
      const mergedConversations = conversations.map((conversation) => {
        const recentLocal = sortMessages(localMessages[conversation.id] ?? []).slice(-1)[0];
        if (!recentLocal) return conversation;
        const localPreview = recentLocal.text?.trim() || (recentLocal.imageUrl ? "Photo" : conversation.lastMessage);
        const localTime = recentLocal.createdAt || conversation.lastMessageAt;
        return {
          ...conversation,
          lastMessage: localPreview,
          lastMessageAt: localTime,
        };
      });
      set({ conversations: mergedConversations, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  selectConversation: async (conv) => {
    set({ selectedConversation: conv, isLoading: true });

    try {
      const remoteMessages = await messageService.getMessages(conv.id);
      const localMessages = get().localMessages[conv.id] ?? [];
      const mergedMessages = mergeMessages(remoteMessages, localMessages);
      set({ messages: mergedMessages, isLoading: false });

      // Mark as read
      if (conv.unreadCount > 0) {
        get().markRead(conv.id);
      }

      // Start polling
      get().startPolling(conv.id);
    } catch {
      const localMessages = get().localMessages[conv.id] ?? [];
      set({ messages: sortMessages(localMessages), isLoading: false });
    }
  },

  sendMessage: async (conversationId, input) => {
    const payload =
      typeof input === "string"
        ? { text: input.trim() }
        : {
            text: input.text?.trim() ?? "",
            imageUrl: input.imageUrl,
            localImageUri: input.localImageUri,
          };

    const hasText = payload.text.length > 0;
    const hasImage = Boolean(payload.imageUrl || payload.localImageUri);
    if (!hasText && !hasImage) return;

    // Use the current user's role for proper bubble alignment.
    const me = useAuthStore.getState().user;
    const senderId = me?.id ?? "me";
    const senderRole: Message["senderRole"] = me?.role ?? "vendor";

    // Optimistic local update
    const optimisticMsg: Message = {
      id: `local_${Date.now()}`,
      conversationId,
      senderId,
      senderRole,
      text: payload.text,
      imageUrl: payload.localImageUri ?? payload.imageUrl,
      createdAt: new Date().toISOString(),
    };

    set((s) => ({
      messages: mergeMessages([...s.messages, optimisticMsg], []),
      localMessages: {
        ...s.localMessages,
        [conversationId]: mergeMessages([optimisticMsg], s.localMessages[conversationId] ?? []),
      },
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              lastMessage: payload.text || (payload.imageUrl || payload.localImageUri ? "Photo" : c.lastMessage),
              lastMessageAt: optimisticMsg.createdAt,
            }
          : c
      ),
      isSending: true,
    }));

    try {
      const realMsg = await messageService.sendMessage(conversationId, {
        text: payload.text,
        imageUrl: payload.imageUrl,
      });
      const normalizedReal = {
        ...realMsg,
        imageUrl: realMsg.imageUrl ?? payload.imageUrl ?? payload.localImageUri,
      };

      // Replace optimistic with real
      set((s) => ({
        messages: mergeMessages(
          s.messages.map((m) => (m.id === optimisticMsg.id ? normalizedReal : m)),
          [],
        ),
        localMessages: {
          ...s.localMessages,
          [conversationId]: mergeMessages(
            s.localMessages[conversationId]?.map((m) => (m.id === optimisticMsg.id ? normalizedReal : m)) ?? [normalizedReal],
            [],
          ),
        },
        isSending: false,
      }));

      // Update conversation list last message
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                lastMessage: payload.text || (normalizedReal.imageUrl ? "Photo" : c.lastMessage),
                lastMessageAt: normalizedReal.createdAt,
              }
            : c
        ),
      }));
    } catch {
      // Keep the optimistic message locally so image/text sending still works in-app.
      set((s) => ({
        isSending: false,
      }));
    }
  },

  startPolling: (conversationId) => {
    // Clear existing
    const existing = get().pollingId;
    if (existing) clearInterval(existing);

    const id = setInterval(async () => {
      try {
        const messages = await messageService.getMessages(conversationId);
        const current = get().messages;
        const local = get().localMessages[conversationId] ?? [];
        const merged = mergeMessages(messages, local);
        // Only update if new messages arrived
        if (merged.length !== current.length) {
          set({ messages: merged });
        }
      } catch {}
    }, POLL_INTERVAL);

    set({ pollingId: id });
  },

  stopPolling: () => {
    const id = get().pollingId;
    if (id) {
      clearInterval(id);
      set({ pollingId: null });
    }
  },

  markRead: async (conversationId) => {
    try {
      await messageService.markAsRead(conversationId);
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === conversationId ? { ...c, unreadCount: 0 } : c
        ),
      }));
    } catch {}
  },

  createConversation: async (participantId, orderId) => {
    const conv = await messageService.createConversation(participantId, orderId);
    set((s) => ({ conversations: [conv, ...s.conversations] }));
    return conv;
  },

  // ─── Legacy compat (used by existing chat screens) ─────────────────────────

  setSelectedConversation: (conv) => {
    if (conv) {
      get().selectConversation(conv);
    } else {
      get().stopPolling();
      set({ selectedConversation: null, messages: [] });
    }
  },

  getMessages: (conversationId) => {
    const { messages, localMessages } = get();
    if (messages.length > 0 && messages[0]?.conversationId === conversationId) {
      return messages;
    }
    return localMessages[conversationId] ?? [];
  },
}));
