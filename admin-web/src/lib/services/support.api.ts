import { apiClient } from "../api";

/**
 * In-app buyer support messaging (2026-09-22 client decision) — the shared
 * admin inbox for support conversations a buyer starts from inside the
 * mobile app. Two genuinely new admin-only endpoints (list/get, permission-
 * gated by support.read on the backend); reading a thread's messages,
 * sending a reply, and marking it read all reuse the existing generic
 * /api/conversations/:id/* endpoints directly (support.mutate-gated there
 * for a SUPPORT-type conversation — see ekiapp-backend-main's messages
 * .service.ts assertConversationAccess()), since any admin with that
 * permission may act on any buyer's thread, not only whoever the thread
 * happened to be created against.
 */

export interface AdminSupportConversation {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string | null;
  buyerAvatar: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSupportMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  attachments: string[];
  readAt: string | null;
  createdAt: string;
  sender: { id: string; name: string; avatar: string | null; role: string } | null;
}

export const supportAPI = {
  async getConversations(): Promise<AdminSupportConversation[]> {
    const res = await apiClient.get<{ items?: AdminSupportConversation[] }>("/admin/support/conversations");
    return res.items ?? [];
  },

  async getConversation(id: string): Promise<AdminSupportConversation> {
    const res = await apiClient.get<{ conversation: AdminSupportConversation }>(`/admin/support/conversations/${id}`);
    return res.conversation;
  },

  async getMessages(conversationId: string): Promise<AdminSupportMessage[]> {
    const res = await apiClient.get<{ items?: AdminSupportMessage[] }>(`/conversations/${conversationId}/messages`);
    return res.items ?? [];
  },

  async sendReply(conversationId: string, text: string): Promise<AdminSupportMessage> {
    const res = await apiClient.post<{ message: AdminSupportMessage }>(`/conversations/${conversationId}/messages`, { text });
    return res.message;
  },

  async markRead(conversationId: string): Promise<void> {
    await apiClient.patch<{ success: boolean }>(`/conversations/${conversationId}/read`, {});
  },
};
