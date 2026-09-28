"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { Button, Card, ErrorPanel, LoadingPanel } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { supportAPI, type AdminSupportConversation, type AdminSupportMessage } from "@/lib/services/support.api";

export default function SupportMessageThreadPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const conversationId = params.id;

  const [conversation, setConversation] = useState<AdminSupportConversation | null>(null);
  const [messages, setMessages] = useState<AdminSupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [conv, msgs] = await Promise.all([
        supportAPI.getConversation(conversationId),
        supportAPI.getMessages(conversationId),
      ]);
      setConversation(conv);
      setMessages(msgs);
      if (conv.unreadCount > 0) {
        // Fire-and-forget — this view having loaded the thread IS the read
        // receipt; a failure here shouldn't block viewing the messages.
        supportAPI.markRead(conversationId).catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Could not load this conversation.");
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    const text = reply.trim();
    if (!text) return;
    setSending(true);
    try {
      const sent = await supportAPI.sendReply(conversationId, text);
      setMessages((prev) => [...prev, sent]);
      setReply("");
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Could not send this reply.");
    } finally {
      setSending(false);
    }
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-4">
          <button onClick={() => router.push("/support-messages")} className="text-sm font-semibold text-[#096B4A] hover:underline">
            ← Back to Support Messages
          </button>

          {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}

          {loading ? (
            <LoadingPanel label="Loading conversation..." />
          ) : !conversation ? null : (
            <>
              <Card>
                <p className="text-base font-bold text-[#101820]">{conversation.buyerName || "Buyer"}</p>
                <p className="mt-0.5 text-sm text-slate-500">{conversation.buyerEmail ?? "No email on file"}</p>
              </Card>

              <Card className="flex max-h-[60vh] flex-col overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-sm text-slate-500">No messages yet.</p>
                ) : (
                  <div className="space-y-3">
                    {messages.map((m) => {
                      const fromAdmin = m.sender?.role === "ADMIN";
                      return (
                        <div key={m.id} className={`flex ${fromAdmin ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${fromAdmin ? "bg-[#096B4A] text-white" : "bg-slate-100 text-slate-800"}`}>
                            <p>{m.text}</p>
                            <p className={`mt-1 text-[11px] ${fromAdmin ? "text-emerald-100" : "text-slate-400"}`}>
                              {fromAdmin ? (m.sender?.name ?? "Eki Support") : (conversation.buyerName || "Buyer")} · {new Date(m.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                )}
              </Card>

              <Card>
                <div className="flex items-end gap-3">
                  <textarea
                    className="w-full flex-1 resize-none rounded-xl border border-slate-200 p-3 text-sm"
                    rows={3}
                    placeholder="Write a reply..."
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                  />
                  <Button onClick={() => void handleSend()} disabled={sending || !reply.trim()}>
                    {sending ? "Sending..." : "Send"}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-slate-400">The buyer sees this reply, and gets an in-app notification, the moment you send it.</p>
              </Card>
            </>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
