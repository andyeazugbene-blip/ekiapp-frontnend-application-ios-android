"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, EmptyState, ErrorPanel, Icon, LoadingPanel, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { supportAPI, type AdminSupportConversation } from "@/lib/services/support.api";

export default function SupportMessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<AdminSupportConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = async (bypassCache = false) => {
    try {
      bypassCache ? setRefreshing(true) : setLoading(true);
      setError("");
      setConversations(await supportAPI.getConversations());
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Could not load support messages.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <PageHeader
            title="Support Messages"
            subtitle="Buyers contact support from inside the app instead of email — reply here and they see it in the app. Any admin can pick up any conversation."
            actions={<Button variant="ghost" disabled={refreshing} onClick={() => void load(true)}><Icon name="refresh" className="h-4 w-4" />{refreshing ? "Refreshing..." : "Refresh"}</Button>}
          />

          {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}

          {loading ? (
            <LoadingPanel label="Loading support messages..." />
          ) : conversations.length === 0 ? (
            <EmptyState title="No support conversations yet." />
          ) : (
            <div className="space-y-3">
              {totalUnread > 0 ? (
                <p className="text-sm font-semibold text-slate-500">{totalUnread} unread message{totalUnread === 1 ? "" : "s"}</p>
              ) : null}
              {conversations.map((c) => (
                <div key={c.id} onClick={() => router.push(`/support-messages/${c.id}`)} className="cursor-pointer">
                  <Card className="transition hover:border-[#096B4A]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-base font-bold text-[#101820]">{c.buyerName || "Buyer"}</p>
                          {c.unreadCount > 0 ? <Badge tone="amber">{c.unreadCount} new</Badge> : null}
                        </div>
                        <p className="mt-0.5 truncate text-sm text-slate-500">{c.buyerEmail ?? ""}</p>
                        <p className="mt-1.5 truncate text-sm text-slate-700">{c.lastMessage || "No messages yet"}</p>
                      </div>
                      <p className="shrink-0 text-xs text-slate-400">{new Date(c.lastMessageAt).toLocaleString()}</p>
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
