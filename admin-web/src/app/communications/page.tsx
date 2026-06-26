"use client";

import { useEffect, useState, useCallback } from "react";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { adminAPI, CommunicationLogEntry, CommunicationTemplate, CommunicationStats, ScheduledCommunication } from "@/lib/services/admin.api";

const EVENT_KEYS = [
  "welcome_buyer", "welcome_vendor",
  "vendor_verification_approved", "vendor_verification_rejected",
  "vendor_first_order", "buyer_order_confirmed",
  "buyer_order_shipped", "buyer_order_delivered",
];

const RECIPIENT_TYPES = ["BUYER", "VENDOR"];
const STATUSES = ["SENT", "QUEUED", "FAILED"];
const PAGE_SIZE = 25;

const AUDIENCES = [
  { value: "all", label: "All users" },
  { value: "vendors", label: "All vendors" },
  { value: "buyers", label: "All buyers" },
  { value: "active_vendors", label: "Active vendors" },
  { value: "new_vendors", label: "New vendors (7d)" },
  { value: "last_30_days_buyers", label: "Recent buyers (30d)" },
  { value: "repeat_buyers", label: "Repeat buyers" },
  { value: "inactive_buyers", label: "Inactive buyers" },
  { value: "first_time_buyers", label: "First-time buyers" },
  { value: "top_customers", label: "Top customers" },
  { value: "individual_vendor", label: "Individual vendor" },
  { value: "individual_buyer", label: "Individual buyer" },
];

const CHANNELS = [
  { value: "in_app_push", label: "In-app + Push" },
  { value: "in_app", label: "In-app only" },
  { value: "push", label: "Push only" },
  { value: "sms", label: "SMS only" },
  { value: "in_app_sms", label: "In-app + SMS" },
  { value: "in_app_push_sms", label: "All channels" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    SENT: "bg-green-100 text-green-800",
    QUEUED: "bg-yellow-100 text-yellow-800",
    FAILED: "bg-red-100 text-red-800",
    SCHEDULED: "bg-blue-100 text-blue-800",
    CANCELLED: "bg-gray-100 text-gray-500",
  };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-800"}`}>{status}</span>;
}

function channelBadge(channel: string) {
  const colors: Record<string, string> = {
    email: "bg-blue-100 text-blue-800",
    push: "bg-purple-100 text-purple-800",
    in_app: "bg-indigo-100 text-indigo-800",
    sms: "bg-orange-100 text-orange-800",
    in_app_push: "bg-violet-100 text-violet-800",
    in_app_sms: "bg-teal-100 text-teal-800",
    in_app_push_sms: "bg-emerald-100 text-emerald-800",
  };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[channel] ?? "bg-gray-100 text-gray-800"}`}>{channel.replace(/_/g, " ")}</span>;
}

type Tab = "history" | "send" | "scheduled" | "analytics" | "templates";

export default function CommunicationsPage() {
  const [logs, setLogs] = useState<CommunicationLogEntry[]>([]);
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [stats, setStats] = useState<CommunicationStats | null>(null);
  const [scheduled, setScheduled] = useState<ScheduledCommunication[]>([]);
  const [scheduledTotal, setScheduledTotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("history");

  const [filterEvent, setFilterEvent] = useState("");
  const [filterRecipient, setFilterRecipient] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(0);

  // Send form
  const [sendAudience, setSendAudience] = useState("all");
  const [sendChannel, setSendChannel] = useState("in_app_push");
  const [sendSubject, setSendSubject] = useState("");
  const [sendBody, setSendBody] = useState("");
  const [sendVendorId, setSendVendorId] = useState("");
  const [sendUserId, setSendUserId] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState("");
  const [sendMode, setSendMode] = useState<"now" | "schedule">("now");
  const [scheduleDate, setScheduleDate] = useState("");

  // Template editing
  const [editingTemplate, setEditingTemplate] = useState<CommunicationTemplate | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editEnabled, setEditEnabled] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const loadLogs = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await adminAPI.getCommunicationLogs({
        eventKey: filterEvent || undefined,
        recipientType: filterRecipient || undefined,
        status: filterStatus || undefined,
        limit: PAGE_SIZE, offset: page * PAGE_SIZE,
      });
      setLogs(result.items); setTotal(result.total);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load communications."); }
    finally { setLoading(false); }
  }, [filterEvent, filterRecipient, filterStatus, page]);

  const loadTemplates = useCallback(async () => {
    try { const result = await adminAPI.getCommunicationTemplates(); setTemplates(result.templates); } catch { /* optional */ }
  }, []);

  const loadStats = useCallback(async () => {
    try { const result = await adminAPI.getCommunicationStats(); setStats(result); } catch { /* optional */ }
  }, []);

  const loadScheduled = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await adminAPI.listScheduledCommunications({ limit: 50 });
      setScheduled(result.items); setScheduledTotal(result.total);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load scheduled."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === "history") void loadLogs();
    if (tab === "templates") void loadTemplates();
    if (tab === "analytics") void loadStats();
    if (tab === "scheduled") void loadScheduled();
  }, [tab, loadLogs, loadTemplates, loadStats, loadScheduled]);

  const handleSend = async () => {
    if (!sendSubject.trim() || !sendBody.trim()) { setSendResult("Subject and body required."); return; }
    if (sendAudience === "individual_vendor" && !sendVendorId.trim()) { setSendResult("Vendor ID required."); return; }
    if (sendAudience === "individual_buyer" && !sendUserId.trim()) { setSendResult("User ID required."); return; }
    if (sendMode === "schedule" && !scheduleDate) { setSendResult("Schedule date/time required."); return; }

    setSending(true); setSendResult("");
    try {
      if (sendMode === "schedule") {
        await adminAPI.createScheduledCommunication({
          audience: sendAudience, channel: sendChannel,
          subject: sendSubject.trim(), body: sendBody.trim(),
          scheduledFor: new Date(scheduleDate).toISOString(),
        });
        setSendResult("Communication scheduled successfully.");
      } else {
        const result = await adminAPI.sendBroadcast({
          audience: sendAudience, channel: sendChannel,
          subject: sendSubject.trim(), body: sendBody.trim(),
          vendorId: sendVendorId.trim() || undefined,
          userId: sendUserId.trim() || undefined,
        });
        setSendResult(`Sent to ${result.sent} recipients. Messages: ${result.messagesCreated}. SMS queued: ${result.smsQueued}.`);
      }
      setSendSubject(""); setSendBody(""); setScheduleDate("");
    } catch (err) { setSendResult(err instanceof Error ? err.message : "Send failed."); }
    finally { setSending(false); }
  };

  const handleCancelScheduled = async (id: string) => {
    try {
      await adminAPI.cancelScheduledCommunication(id);
      void loadScheduled();
    } catch (err) { alert(err instanceof Error ? err.message : "Cancel failed."); }
  };

  const handleRunScheduled = async () => {
    try {
      const result = await adminAPI.runScheduledCommunications();
      alert(`Processed: ${result.processed}, Sent: ${result.sent}, Failed: ${result.failed}`);
      void loadScheduled();
    } catch (err) { alert(err instanceof Error ? err.message : "Run failed."); }
  };

  const handleSeedTemplates = async () => {
    try {
      const result = await adminAPI.seedTemplates();
      alert(`Seeded ${result.seeded} templates.`);
      void loadTemplates();
    } catch (err) { alert(err instanceof Error ? err.message : "Seed failed."); }
  };

  const openTemplateEditor = (tmpl: CommunicationTemplate) => {
    setEditingTemplate(tmpl);
    setEditTitle(tmpl.title);
    setEditBody(tmpl.body);
    setEditEnabled(tmpl.enabled);
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    setSavingTemplate(true);
    try {
      await adminAPI.updateTemplate(editingTemplate.key, {
        title: editTitle, body: editBody, enabled: editEnabled,
      });
      setEditingTemplate(null);
      void loadTemplates();
    } catch (err) { alert(err instanceof Error ? err.message : "Save failed."); }
    finally { setSavingTemplate(false); }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const tabList: { key: Tab; label: string }[] = [
    { key: "history", label: "History" },
    { key: "send", label: "Send" },
    { key: "scheduled", label: "Scheduled" },
    { key: "analytics", label: "Analytics" },
    { key: "templates", label: "Templates" },
  ];

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Communications</h1>
            <p className="mt-1 text-sm text-gray-600">Automated messages, broadcast sending, scheduling, and delivery analytics.</p>
          </div>

          <div className="flex gap-2">
            {tabList.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === t.key ? "bg-[#076B51] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          {/* ── History ────────────────────────────────────── */}
          {tab === "history" && (
            <>
              <div className="flex flex-wrap gap-3">
                <select value={filterEvent} onChange={(e) => { setFilterEvent(e.target.value); setPage(0); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="">All events</option>
                  {EVENT_KEYS.map((k) => <option key={k} value={k}>{k.replace(/_/g, " ")}</option>)}
                </select>
                <select value={filterRecipient} onChange={(e) => { setFilterRecipient(e.target.value); setPage(0); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="">All recipients</option>
                  {RECIPIENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="">All statuses</option>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="overflow-hidden rounded-xl bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">When</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Event</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Recipient</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Channel</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Title</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {loading ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">Loading...</td></tr>
                    ) : logs.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">No communications found.</td></tr>
                    ) : logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{formatDate(log.createdAt)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{log.eventKey.replace(/_/g, " ")}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{log.recipientType}</span>
                          <span className="ml-1 text-xs text-gray-400">{log.recipientId.slice(0, 8)}...</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">{channelBadge(log.channel)}</td>
                        <td className="max-w-[250px] truncate px-4 py-3 text-sm text-gray-700" title={log.title}>{log.title}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">{statusBadge(log.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">{total} total</p>
                  <div className="flex gap-2">
                    <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50">Previous</button>
                    <span className="flex items-center text-sm text-gray-600">Page {page + 1} of {totalPages}</span>
                    <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50">Next</button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Send ─────────────────────────────────────── */}
          {tab === "send" && (
            <div className="mx-auto max-w-2xl space-y-5 rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900">Send Broadcast</h2>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input type="radio" checked={sendMode === "now"} onChange={() => setSendMode("now")} className="accent-[#076B51]" />
                  Send Now
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input type="radio" checked={sendMode === "schedule"} onChange={() => setSendMode("schedule")} className="accent-[#076B51]" />
                  Schedule Later
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Audience</label>
                  <select value={sendAudience} onChange={(e) => setSendAudience(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                    {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Channel</label>
                  <select value={sendChannel} onChange={(e) => setSendChannel(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                    {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              {sendAudience === "individual_vendor" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Vendor ID</label>
                  <input value={sendVendorId} onChange={(e) => setSendVendorId(e.target.value)} placeholder="clx..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </div>
              )}

              {sendAudience === "individual_buyer" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">User ID</label>
                  <input value={sendUserId} onChange={(e) => setSendUserId(e.target.value)} placeholder="clx..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </div>
              )}

              {sendMode === "schedule" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Schedule for</label>
                  <input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Subject</label>
                <input value={sendSubject} onChange={(e) => setSendSubject(e.target.value)} maxLength={120} placeholder="Message subject" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Body</label>
                <textarea value={sendBody} onChange={(e) => setSendBody(e.target.value)} maxLength={1000} rows={4} placeholder="Message body..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>

              <div className="flex items-center gap-4">
                <button disabled={sending} onClick={() => void handleSend()} className="rounded-lg bg-[#076B51] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#065a44] disabled:opacity-50">
                  {sending ? "Processing..." : sendMode === "schedule" ? "Schedule" : "Send Now"}
                </button>
                {sendResult && <p className="text-sm text-gray-600">{sendResult}</p>}
              </div>
            </div>
          )}

          {/* ── Scheduled ────────────────────────────────── */}
          {tab === "scheduled" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">{scheduledTotal} scheduled communications</p>
                <button onClick={() => void handleRunScheduled()} className="rounded-lg border border-[#076B51] px-4 py-2 text-sm font-medium text-[#076B51] hover:bg-emerald-50">
                  Run Due Now
                </button>
              </div>

              <div className="overflow-hidden rounded-xl bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Audience</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Channel</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Subject</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Scheduled For</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Sent At</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {loading ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">Loading...</td></tr>
                    ) : scheduled.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">No scheduled communications.</td></tr>
                    ) : scheduled.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-3 text-sm">{statusBadge(item.status)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{item.audience.replace(/_/g, " ")}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">{channelBadge(item.channel)}</td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-sm text-gray-700" title={item.subject}>{item.subject}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{formatDate(item.scheduledFor)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{item.sentAt ? formatDate(item.sentAt) : "—"}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                          {item.status === "SCHEDULED" && (
                            <button onClick={() => void handleCancelScheduled(item.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Cancel</button>
                          )}
                          {item.status === "FAILED" && item.error && (
                            <span className="text-xs text-red-500" title={item.error}>Error</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Analytics ─────────────────────────────────── */}
          {tab === "analytics" && (
            <div className="space-y-6">
              {!stats ? (
                <p className="text-sm text-gray-500">Loading analytics...</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <StatCard label="Total Sent" value={stats.totalSent} color="text-green-700" />
                    <StatCard label="Total Failed" value={stats.totalFailed} color="text-red-700" />
                    <StatCard label="Queued" value={stats.totalQueued} color="text-amber-700" />
                    <StatCard label="Total" value={stats.total} />
                  </div>

                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="rounded-xl bg-white p-5 shadow-sm">
                      <h3 className="mb-3 text-sm font-bold text-gray-700">By Event</h3>
                      <div className="space-y-2">
                        {stats.byEvent.length === 0 ? <p className="text-sm text-gray-400">No data</p> : stats.byEvent.map((e) => (
                          <div key={e.event} className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">{e.event.replace(/_/g, " ")}</span>
                            <span className="text-sm font-semibold text-gray-900">{e.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl bg-white p-5 shadow-sm">
                      <h3 className="mb-3 text-sm font-bold text-gray-700">By Channel</h3>
                      <div className="space-y-2">
                        {stats.byChannel.length === 0 ? <p className="text-sm text-gray-400">No data</p> : stats.byChannel.map((c) => (
                          <div key={c.channel} className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">{c.channel}</span>
                            <span className="text-sm font-semibold text-gray-900">{c.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Templates ─────────────────────────────────── */}
          {tab === "templates" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">Templates are stored in the database and editable. Click a template to edit.</p>
                <button onClick={() => void handleSeedTemplates()} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                  Seed defaults
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {templates.length === 0 ? (
                  <p className="col-span-full text-sm text-gray-500">No templates found. Click &quot;Seed defaults&quot; to populate from code defaults.</p>
                ) : templates.map((tmpl) => (
                  <button key={tmpl.key} onClick={() => openTemplateEditor(tmpl)} className="rounded-xl border bg-white p-5 shadow-sm text-left hover:border-[#076B51] transition">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900">{tmpl.key.replace(/_/g, " ")}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tmpl.enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`}>
                        {tmpl.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <p className="mb-3 text-xs text-gray-500">{tmpl.recipientType} &middot; {tmpl.channels.join(", ")}</p>
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="mb-1 text-xs font-medium text-gray-700">{tmpl.title}</p>
                      <p className="text-xs text-gray-600">{tmpl.body}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Template Edit Modal ──────────────────────── */}
          {editingTemplate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
              <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900">Edit: {editingTemplate.key.replace(/_/g, " ")}</h2>
                  <button onClick={() => setEditingTemplate(null)} className="rounded-lg border px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50">Close</button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Title / Subject</label>
                    <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Body</label>
                    <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={5} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    <p className="mt-1 text-xs text-gray-400">Variables: {"{{name}}"}, {"{{store_name}}"}, {"{{order_number}}"}, {"{{amount}}"}, {"{{reason}}"}</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input type="checkbox" checked={editEnabled} onChange={(e) => setEditEnabled(e.target.checked)} className="accent-[#076B51]" />
                    Enabled
                  </label>
                  <div className="flex gap-3 pt-2">
                    <button disabled={savingTemplate} onClick={() => void handleSaveTemplate()} className="rounded-lg bg-[#076B51] px-5 py-2 text-sm font-medium text-white hover:bg-[#065a44] disabled:opacity-50">
                      {savingTemplate ? "Saving..." : "Save"}
                    </button>
                    <button onClick={() => setEditingTemplate(null)} className="rounded-lg border px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-black ${color ?? "text-gray-900"}`}>{value}</p>
    </div>
  );
}
