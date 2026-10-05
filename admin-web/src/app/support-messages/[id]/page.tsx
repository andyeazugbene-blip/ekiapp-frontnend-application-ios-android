"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, LoadingPanel } from "@/components/AdminUI";
import { Banner, KeyValue, formatDateTime, timeAgo, useConfirm } from "@/components/AdminKit";
import ProtectedRoute from "@/components/ProtectedRoute";
import { NoAccess } from "@/components/PageStates";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { APIError } from "@/lib/api";
import { supportAPI, type AdminSupportConversation, type AdminSupportMessage } from "@/lib/services/support.api";

const POLL_MS = 20_000;
const MAX_ATTACHMENTS = 5;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

function safeHttpUrl(u: string): string | null {
  return /^https?:\/\//i.test(u) ? u : null;
}
function isImageUrl(u: string): boolean {
  return /\.(png|jpe?g|gif|webp)(\?|$)/i.test(u) || u.includes("mock-download");
}
function fileLabel(u: string): string {
  try {
    const last = decodeURIComponent(new URL(u).pathname.split("/").pop() || "attachment");
    return last.length > 40 ? `${last.slice(0, 37)}...` : last;
  } catch {
    return "attachment";
  }
}
function mergeById(prev: AdminSupportMessage[], incoming: AdminSupportMessage[]): AdminSupportMessage[] {
  const map = new Map(prev.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, m);
  return Array.from(map.values()).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id));
}

export default function ConversationThreadPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const confirm = useConfirm();
  const canMutate = usePermissions().has("support.mutate");

  const [conv, setConv] = useState<AdminSupportConversation | null>(null);
  const [messages, setMessages] = useState<AdminSupportMessage[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<{ message: string; forbidden: boolean } | null>(null);
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [actionError, setActionError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const markedRead = useRef(false);

  const fail = (err: unknown, fallback: string) => ({
    message: err instanceof APIError ? (err.status === 403 ? "You do not have permission to view this conversation." : err.status === 404 ? "This conversation was not found." : err.message) : fallback,
    forbidden: err instanceof APIError && err.status === 403,
  });

  const refresh = useCallback(async (initial = false) => {
    try {
      const [c, page] = await Promise.all([supportAPI.getConversation(id), supportAPI.getMessages(id)]);
      setConv(c);
      setMessages((prev) => (initial ? page.items : mergeById(prev, page.items)));
      if (initial) setOlderCursor(page.nextCursor);
      setError(null);
      if (c.unreadCount > 0 && !markedRead.current) {
        markedRead.current = true;
        // Opening the thread is the read receipt; failure must not block viewing.
        supportAPI.markRead(id).then(() => { markedRead.current = false; }).catch(() => { markedRead.current = false; });
      }
    } catch (err) {
      if (initial) setError(fail(err, "Could not load this conversation."));
    } finally {
      if (initial) setLoading(false);
    }
  }, [id]);

  useEffect(() => { void refresh(true); }, [refresh]);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") void refresh(false); }, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);
  useEffect(() => {
    if (stickToBottom.current) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const loadEarlier = async () => {
    if (!olderCursor) return;
    setLoadingOlder(true);
    stickToBottom.current = false;
    try {
      const page = await supportAPI.getMessages(id, olderCursor);
      setMessages((prev) => mergeById(prev, page.items));
      setOlderCursor(page.nextCursor);
    } catch (err) {
      setActionError(err instanceof APIError ? err.message : "Could not load earlier messages.");
    } finally {
      setLoadingOlder(false);
    }
  };

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSendError("");
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (attachments.length >= MAX_ATTACHMENTS) { setSendError(`You can attach at most ${MAX_ATTACHMENTS} files.`); break; }
        if (!ALLOWED_TYPES.includes(file.type)) { setSendError("Only JPEG, PNG, WebP, GIF or PDF files can be attached."); continue; }
        if (file.size > MAX_FILE_BYTES) { setSendError(`${file.name} is larger than 5 MB.`); continue; }
        const url = await supportAPI.uploadAttachment(file);
        setAttachments((prev) => [...prev, url]);
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const send = async () => {
    const body = text.trim() || (attachments.length ? "Attachment" : "");
    if (!body) return;
    setSending(true);
    setSendError("");
    try {
      const sent = await supportAPI.reply(id, { text: body, attachments, isInternal: mode === "note" });
      stickToBottom.current = true;
      setMessages((prev) => mergeById(prev, [sent]));
      setText("");
      setAttachments([]);
      void refresh(false);
    } catch (err) {
      setSendError(err instanceof APIError ? err.message : "Could not send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const act = (action: "close" | "reopen" | "escalate" | "deescalate") => {
    const copy = {
      close: { title: "Close this conversation?", desc: "It moves out of the Open list. If the participant writes again it reopens automatically.", label: "Close conversation", tone: "primary" as const },
      reopen: { title: "Reopen this conversation?", desc: "It returns to the Open list.", label: "Reopen", tone: "primary" as const },
      escalate: { title: "Escalate this conversation?", desc: "Flags it for senior attention. The reason is saved as the escalation note.", label: "Escalate", tone: "danger" as const },
      deescalate: { title: "Remove escalation?", desc: "The escalation flag and note are cleared (kept in the audit log).", label: "Remove escalation", tone: "primary" as const },
    }[action];
    setActionError("");
    confirm.ask(
      { title: copy.title, description: copy.desc, confirmLabel: copy.label, tone: copy.tone },
      async (reason) => {
        const updated = await supportAPI.transition(id, action, reason);
        setConv(updated);
      },
    );
  };

  const cp = conv?.counterparty ?? null;
  const profileHref = cp ? (cp.role === "VENDOR" && cp.vendorId ? `/vendors/${cp.vendorId}` : `/users/${cp.id}`) : null;
  const closed = conv?.status === "CLOSED";
  const hasMore = useMemo(() => !!olderCursor, [olderCursor]);

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-4">
          <button onClick={() => router.push("/support-messages")} className="text-sm font-semibold text-[#096B4A] hover:underline">
            &larr; Back to Conversations
          </button>

          {error ? (
            error.forbidden
              ? <NoAccess what="this conversation" />
              : <ErrorPanel message={error.message} onRetry={() => { setLoading(true); void refresh(true); }} />
          ) : loading ? (
            <LoadingPanel label="Loading conversation..." />
          ) : !conv ? null : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-4">
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="truncate text-2xl font-black text-[#101820]">{cp?.name || "Unknown user"}</h1>
                        <Badge tone={cp?.role === "VENDOR" ? "blue" : "green"}>{cp?.role ?? "UNKNOWN"}</Badge>
                        <Badge tone={closed ? "gray" : "green"}>{closed ? "Closed" : "Open"}</Badge>
                        {conv.escalated ? <Badge tone="red">Escalated</Badge> : null}
                        {conv.reported ? <Badge tone="amber">Reported</Badge> : null}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{cp?.email ?? "No email on file"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!canMutate ? null : closed
                        ? <Button variant="secondary" onClick={() => act("reopen")}>Reopen</Button>
                        : <Button variant="secondary" onClick={() => act("close")}>Close</Button>}
                      {!canMutate ? null : conv.escalated
                        ? <Button variant="ghost" onClick={() => act("deescalate")}>Remove escalation</Button>
                        : <Button variant="ghost" onClick={() => act("escalate")}>Escalate</Button>}
                    </div>
                  </div>
                  {actionError ? <p className="mt-3 text-sm font-bold text-red-700">{actionError}</p> : null}
                </Card>

                {conv.escalated && conv.escalationNote ? (
                  <Banner tone="warning" title="Escalated">{conv.escalationNote} <span className="text-xs">({formatDateTime(conv.escalatedAt)})</span></Banner>
                ) : null}

                <Card className="max-h-[60vh] overflow-y-auto" >
                  {hasMore ? (
                    <div className="mb-3 text-center">
                      <Button variant="ghost" className="h-9" disabled={loadingOlder} onClick={() => void loadEarlier()}>{loadingOlder ? "Loading..." : "Load earlier messages"}</Button>
                    </div>
                  ) : null}
                  {messages.length === 0 ? (
                    <p className="text-sm text-slate-500">No messages yet.</p>
                  ) : (
                    <ol className="space-y-3" aria-label="Messages">
                      {messages.map((m) => {
                        const fromSupport = m.sender?.role === "ADMIN";
                        const note = m.isInternal;
                        const bubble = note
                          ? "border border-amber-200 bg-amber-50 text-amber-950"
                          : fromSupport ? "bg-[#096B4A] text-white" : "bg-slate-100 text-slate-800";
                        const meta = fromSupport && !note ? "text-emerald-100" : note ? "text-amber-700" : "text-slate-500";
                        return (
                          <li key={m.id} className={`flex ${fromSupport ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${bubble}`}>
                              {note ? <p className="mb-1 text-[11px] font-black uppercase tracking-wide">Internal note · only admins see this</p> : null}
                              <p className="whitespace-pre-wrap break-words">{m.text}</p>
                              {m.attachments.length > 0 ? (
                                <ul className="mt-2 space-y-1.5">
                                  {m.attachments.map((u, i) => {
                                    const href = safeHttpUrl(u);
                                    if (!href) return <li key={i} className="text-xs italic opacity-80">Unsafe attachment link hidden</li>;
                                    return (
                                      <li key={i}>
                                        <a href={href} target="_blank" rel="noopener noreferrer" className="block underline">
                                          {isImageUrl(href)
                                            // eslint-disable-next-line @next/next/no-img-element
                                            ? <img src={href} alt={fileLabel(href)} className="max-h-44 rounded-lg border border-white/30" />
                                            : fileLabel(href)}
                                        </a>
                                      </li>
                                    );
                                  })}
                                </ul>
                              ) : null}
                              <p className={`mt-1 text-[11px] ${meta}`}>
                                {m.sender?.name ?? (fromSupport ? "Eki Support" : cp?.name ?? "Participant")} · {formatDateTime(m.createdAt)}
                                {fromSupport && !note ? (m.readAt ? ` · Read ${timeAgo(m.readAt)}` : " · Sent, not read yet") : ""}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  <div ref={bottomRef} />
                </Card>

                {!canMutate ? <Banner tone="info">You have read-only access (support.read). Replying, notes and status changes need support.mutate.</Banner> : (
                <Card>
                  {closed ? (
                    <Banner tone="info">This conversation is closed. A reply is delivered but does not reopen it; the participant writing again does. Use Reopen to keep working it.</Banner>
                  ) : null}
                  <div className="mt-3 flex gap-2" role="tablist" aria-label="Message type">
                    {([["reply", "Reply to participant"], ["note", "Internal note"]] as const).map(([k, label]) => (
                      <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)}
                        className={`rounded-xl border px-4 py-2 text-sm font-bold ${mode === k ? (k === "note" ? "border-amber-400 bg-amber-50 text-amber-900" : "border-[#096B4A] bg-[#096B4A] text-white") : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <label className="mt-3 block">
                    <span className="sr-only">{mode === "note" ? "Internal note" : "Reply"}</span>
                    <textarea
                      className={`w-full resize-y rounded-xl border p-3 text-sm outline-none focus:border-[#096B4A] ${mode === "note" ? "border-amber-300 bg-amber-50/50" : "border-slate-200"}`}
                      rows={3}
                      maxLength={5000}
                      placeholder={mode === "note" ? "Write an internal note (never shown to the participant)..." : "Write a reply..."}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); } }}
                    />
                  </label>
                  {attachments.length > 0 ? (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {attachments.map((u, i) => (
                        <li key={u} className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                          {fileLabel(u)}
                          <button type="button" aria-label={`Remove attachment ${i + 1}`} className="font-black text-slate-500 hover:text-red-600" onClick={() => setAttachments((prev) => prev.filter((x) => x !== u))}>×</button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {sendError ? <p className="mt-2 text-sm font-bold text-red-700">{sendError}</p> : null}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <input ref={fileRef} type="file" multiple accept={ALLOWED_TYPES.join(",")} className="sr-only" id="support-attach" onChange={(e) => void onPickFiles(e.target.files)} />
                      <label htmlFor="support-attach" className={`inline-flex h-11 cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 ${uploading ? "opacity-55" : ""}`}>
                        {uploading ? "Uploading..." : "Attach file"}
                      </label>
                      <span className="text-xs text-slate-500">
                        {mode === "note" ? "Internal notes are not sent to the participant." : "The participant is notified in-app when you send."} Ctrl+Enter to send.
                      </span>
                    </div>
                    <Button onClick={() => void send()} disabled={sending || uploading || (!text.trim() && attachments.length === 0)}>
                      {sending ? "Sending..." : mode === "note" ? "Add note" : "Send reply"}
                    </Button>
                  </div>
                </Card>
                )}
              </div>

              <aside className="space-y-4" aria-label="Conversation context">
                <Card>
                  <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Participant</h2>
                  <KeyValue items={[
                    { label: "Name", value: cp?.userName || "Not provided" },
                    { label: "Role", value: cp?.role ?? "Not provided" },
                    { label: "Store", value: cp?.storeName ?? (cp?.role === "VENDOR" ? "Not provided" : "Not applicable") },
                    { label: "Email", value: cp?.email ?? "Not provided" },
                  ]} />
                  {profileHref ? (
                    <Link href={profileHref} className="mt-3 inline-block text-sm font-bold text-[#096B4A] hover:underline">
                      Open {cp?.role === "VENDOR" ? "vendor" : "user"} profile
                    </Link>
                  ) : null}
                </Card>
                <Card>
                  <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Linked record</h2>
                  {conv.orderId ? (
                    <Link href={`/orders/${conv.orderId}`} className="text-sm font-bold text-[#096B4A] hover:underline">
                      Order {conv.orderNumber ?? conv.orderId}
                    </Link>
                  ) : (
                    <p className="text-sm text-slate-500">Not linked to an order.</p>
                  )}
                </Card>
                <Card>
                  <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Conversation</h2>
                  <KeyValue items={[
                    { label: "Started", value: formatDateTime(conv.createdAt) },
                    { label: "Last activity", value: formatDateTime(conv.lastMessageAt) },
                    { label: "Status", value: closed ? `Closed ${formatDateTime(conv.closedAt)}` : "Open" },
                    { label: "Internal notes", value: String(conv.internalNoteCount) },
                  ]} />
                  <Link href={`/activity-logs?entityId=${conv.id}`} className="mt-3 inline-block text-sm font-bold text-[#096B4A] hover:underline">View audit trail</Link>
                </Card>
              </aside>
            </div>
          )}
        </div>
        {confirm.dialog}
      </AdminLayout>
    </ProtectedRoute>
  );
}
