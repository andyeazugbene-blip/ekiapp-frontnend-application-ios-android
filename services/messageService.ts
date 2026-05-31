/**
 * Message service for authenticated conversations.
 */
import { apiClient } from "./api";

export interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  participantAvatar?: string;
  participantRole: "buyer" | "vendor" | "admin";
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  orderId?: string;
  orderNumber?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: "buyer" | "vendor" | "admin";
  text: string;
  imageUrl?: string;
  createdAt: string;
}

interface ConversationListResponse {
  items?: any[];
  conversations?: any[];
  nextCursor?: string | null;
}

interface MessageListResponse {
  items?: any[];
  messages?: any[];
  nextCursor?: string | null;
}

interface MessageResponse {
  message: Message;
}

interface ConversationResponse {
  conversation: any;
}

function normalizeConversation(c: any, participantId = ""): Conversation {
  return {
    id: c.id,
    participantId: c.participantId ?? c.participantA ?? c.participantB ?? participantId,
    participantName: c.participantUser?.name ?? c.participantName ?? c.otherParticipant?.name ?? "User",
    participantAvatar: c.participantUser?.avatar ?? c.participantAvatar ?? c.otherParticipant?.avatar,
    participantRole: (c.participantUser?.role?.toLowerCase() ?? c.participantRole ?? "buyer") as Conversation["participantRole"],
    lastMessage: c.lastMessage?.text ?? c.lastMessage ?? "",
    lastMessageAt: c.lastMessageAt ?? c.updatedAt ?? c.createdAt ?? new Date().toISOString(),
    unreadCount: c.unreadCount ?? 0,
    orderId: c.orderId ?? undefined,
    orderNumber: c.orderNumber ?? undefined,
  };
}

function normalizeMessage(m: any): Message {
  const firstAttachment =
    Array.isArray(m.attachments) && m.attachments.length > 0
      ? typeof m.attachments[0] === "string"
        ? m.attachments[0]
        : m.attachments[0]?.url
      : undefined;

  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    senderRole: (m.sender?.role?.toLowerCase() ?? m.senderRole ?? "buyer") as Message["senderRole"],
    text: m.text ?? "",
    imageUrl:
      m.imageUrl ??
      m.mediaUrl ??
      m.attachmentUrl ??
      firstAttachment,
    createdAt: m.createdAt ?? new Date().toISOString(),
  };
}

export interface SendMessageInput {
  text?: string;
  imageUrl?: string;
}

export const messageService = {
  async getConversations(): Promise<Conversation[]> {
    const response = await apiClient.get<ConversationListResponse>("/api/conversations");
    return (response.items ?? response.conversations ?? []).map((c) => normalizeConversation(c));
  },

  async createConversation(participantId: string, orderId?: string): Promise<Conversation> {
    const response = await apiClient.post<ConversationResponse>("/api/conversations", { participantId, orderId });
    return normalizeConversation(response.conversation, participantId);
  },

  async getMessages(conversationId: string): Promise<Message[]> {
    const response = await apiClient.get<MessageListResponse>(`/api/conversations/${conversationId}/messages`);
    return (response.items ?? response.messages ?? []).map(normalizeMessage);
  },

  async sendMessage(conversationId: string, input: string | SendMessageInput): Promise<Message> {
    const text = (typeof input === "string" ? input : input.text ?? "").trim();
    const imageUrl = typeof input === "string" ? undefined : input.imageUrl?.trim() || undefined;
    const resolvedText = text || (imageUrl ? "Shared an image" : "");

    if (!resolvedText) {
      throw new Error("Message text is required.");
    }

    const payload = imageUrl
      ? { text: resolvedText, attachments: [imageUrl] }
      : { text: resolvedText };

    const response = await apiClient.post<MessageResponse>(`/api/conversations/${conversationId}/messages`, payload);
    return normalizeMessage(response.message);
  },

  async markAsRead(conversationId: string): Promise<void> {
    await apiClient.patch<void>(`/api/conversations/${conversationId}/read`, {});
  },
};
