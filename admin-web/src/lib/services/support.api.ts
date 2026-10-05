import { apiClient } from "../api";

/**
 * Admin shared support inbox (handbook 6.1 / 14.2). Server-side filters and
 * cursor pagination; lifecycle actions need a reason and are audited.
 * The inbox contains SUPPORT threads plus any thread with an admin
 * participant (e.g. a vendor's reply to a broadcast).
 *
 * Reading the thread for admins uses /admin/support/conversations/:id/messages
 * (includes internal notes). The participant route /conversations/:id/messages
 * never returns internal notes and is not used here.
 */

export type SupportStatus = "OPEN" | "CLOSED";

export interface SupportParticipant {
  id: string;
  /** Store name for vendors, otherwise the person's name. */
  name: string;
  userName: string;
  email: string | null;
  avatar: string | null;
  role: "BUYER" | "VENDOR" | "ADMIN";
  storeName: string | null;
  vendorId: string | null;
}

export interface AdminSupportConversation {
  id: string;
  type: string;
  status: SupportStatus;
  closedAt: string | null;
  closedById: string | null;
  escalated: boolean;
  escalatedAt: string | null;
  escalatedById: string | null;
  escalationNote: string | null;
  reported: boolean;
  counterparty: SupportParticipant | null;
  orderId: string | null;
  orderNumber: string | null;
  lastMessage: string;
  lastMessageFromCounterparty: boolean | null;
  lastMessageAt: string;
  unreadCount: number;
  internalNoteCount: number;
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
  isInternal: boolean;
  createdAt: string;
  sender: { id: string; name: string; avatar: string | null; role: string } | null;
}

export interface SupportCounts {
  open: number;
  closed: number;
  all: number;
  unread: number;
  escalated: number;
}

export interface SupportListFilters {
  status?: "open" | "closed" | "all";
  unread?: boolean;
  escalated?: boolean;
  reported?: boolean;
  orderLinked?: boolean;
  orderId?: string;
  role?: "buyer" | "vendor" | "";
  q?: string;
  cursor?: string;
  limit?: number;
}

export interface SupportListResult {
  items: AdminSupportConversation[];
  nextCursor: string | null;
  total: number;
  counts: SupportCounts;
}

export type SupportLifecycleAction = "close" | "reopen" | "escalate" | "deescalate";

export const supportAPI = {
  async list(filters: SupportListFilters = {}): Promise<SupportListResult> {
    const p = new URLSearchParams();
    if (filters.status) p.set("status", filters.status);
    if (filters.unread) p.set("unread", "true");
    if (filters.escalated) p.set("escalated", "true");
    if (filters.reported) p.set("reported", "true");
    if (filters.orderLinked) p.set("orderLinked", "true");
    if (filters.orderId) p.set("orderId", filters.orderId);
    if (filters.role) p.set("role", filters.role);
    if (filters.q) p.set("q", filters.q);
    if (filters.cursor) p.set("cursor", filters.cursor);
    p.set("limit", String(filters.limit ?? 25));
    const res = await apiClient.get<Partial<SupportListResult>>(`/admin/support/conversations?${p.toString()}`, { bypassCache: true });
    return {
      items: res.items ?? [],
      nextCursor: res.nextCursor ?? null,
      total: res.total ?? 0,
      counts: res.counts ?? { open: 0, closed: 0, all: 0, unread: 0, escalated: 0 },
    };
  },

  async getConversation(id: string): Promise<AdminSupportConversation> {
    const res = await apiClient.get<{ conversation: AdminSupportConversation }>(`/admin/support/conversations/${id}`, { bypassCache: true });
    return res.conversation;
  },

  /** Oldest-first page; pass the returned nextCursor to load earlier messages. */
  async getMessages(id: string, cursor?: string, limit = 30): Promise<{ items: AdminSupportMessage[]; nextCursor: string | null }> {
    const p = new URLSearchParams({ limit: String(limit) });
    if (cursor) p.set("cursor", cursor);
    const res = await apiClient.get<{ items?: AdminSupportMessage[]; nextCursor?: string | null }>(
      `/admin/support/conversations/${id}/messages?${p.toString()}`,
      { bypassCache: true },
    );
    return { items: res.items ?? [], nextCursor: res.nextCursor ?? null };
  },

  async reply(id: string, input: { text: string; attachments?: string[]; isInternal?: boolean }): Promise<AdminSupportMessage> {
    const res = await apiClient.post<{ message: AdminSupportMessage }>(`/admin/support/conversations/${id}/messages`, input);
    return res.message;
  },

  async markRead(id: string): Promise<void> {
    await apiClient.patch<{ success: boolean }>(`/conversations/${id}/read`, {});
  },

  async transition(id: string, action: SupportLifecycleAction, reason: string): Promise<AdminSupportConversation> {
    const res = await apiClient.patch<{ conversation: AdminSupportConversation }>(`/admin/support/conversations/${id}/${action}`, { reason });
    return res.conversation;
  },

  /** Upload a file via the existing uploads API ("message" category) and return its URL. */
  async uploadAttachment(file: File): Promise<string> {
    const req = await apiClient.post<{ assetId: string; uploadUrl: string; publicUrl?: string; key: string }>("/uploads/request-url", {
      filename: file.name,
      contentType: file.type,
      category: "message",
    });
    const put = await fetch(req.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    if (!put.ok) throw new Error("Upload failed. Please try again.");
    const done = await apiClient.post<{ publicUrl?: string; key: string }>("/uploads/complete", {
      assetId: req.assetId,
      key: req.key,
      sizeBytes: file.size,
    });
    const url = done.publicUrl ?? req.publicUrl;
    if (!url || !/^https?:\/\//i.test(url)) throw new Error("Upload completed but no file URL was returned.");
    return url;
  },
};
