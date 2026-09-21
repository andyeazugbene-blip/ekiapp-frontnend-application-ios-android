"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, Icon, LoadingPanel, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { API2FARequiredError, APIError } from "@/lib/api";
import { communityBuyAdminAPI, type AdminDataAccessLogEntry } from "@/lib/services/communityBuy.api";

/**
 * M4 (spec §14, §15.8, §19) — the data-access audit search surface and the
 * emergency real-number disclosure request form. Disclosure itself is
 * always four-eyes gated (community_buy.emergency_contact_disclosure): this
 * page only ever creates the pending approval; a second, different admin
 * decides it from the existing Approvals queue, where the actual grant is
 * created (admin-approvals.controller.ts).
 */

function actionTone(action: AdminDataAccessLogEntry["action"]): "green" | "amber" | "red" | "blue" | "gray" {
  switch (action) {
    case "ACCESS_REVOKED": return "red";
    case "ADMIN_OVERRIDE": return "amber";
    case "VIEWED": return "blue";
    default: return "gray";
  }
}

export default function CommunityDataAccessPage() {
  const [logs, setLogs] = useState<AdminDataAccessLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [campaignIdFilter, setCampaignIdFilter] = useState("");
  const [actionFilter, setActionFilter] = useState<AdminDataAccessLogEntry["action"] | "ALL">("ALL");

  const [disclosureCampaignId, setDisclosureCampaignId] = useState("");
  const [disclosureContributionId, setDisclosureContributionId] = useState("");
  const [disclosureReason, setDisclosureReason] = useState("");
  const [requestingDisclosure, setRequestingDisclosure] = useState(false);
  const [disclosureMessage, setDisclosureMessage] = useState("");
  // Phase 8 — the disclosure request itself is 2FA-gated server-side
  // (require2fa), on top of the separate four-eyes approval a different
  // admin later decides. Without this, a 2FA-enabled admin's click just
  // 403'd with no recovery.
  const [pendingDisclosure, setPendingDisclosure] = useState<{ campaignId: string; contributionId: string; reason: string } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");

  const load = async (bypassCache = false) => {
    try {
      bypassCache ? setRefreshing(true) : setLoading(true);
      setError("");
      setLogs(await communityBuyAdminAPI.getDataAccessLog(
        campaignIdFilter.trim() ? { campaignId: campaignIdFilter.trim() } : undefined,
        bypassCache ? { bypassCache: true } : undefined,
      ));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load the data-access log");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const requestDisclosure = async (override?: { campaignId: string; contributionId: string; reason: string }, code?: string) => {
    const campaignId = override?.campaignId ?? disclosureCampaignId.trim();
    const contributionId = override?.contributionId ?? disclosureContributionId.trim();
    const reason = override?.reason ?? disclosureReason.trim();
    if (!campaignId || !contributionId || !reason) return;
    if (!code && !confirm("Request emergency contact disclosure? This requires a second, different admin's approval, and the resulting access expires automatically.")) return;
    setRequestingDisclosure(true);
    setDisclosureMessage("");
    try {
      const result = await communityBuyAdminAPI.requestEmergencyDisclosure(campaignId, contributionId, reason, code);
      setDisclosureMessage(result.message);
      setDisclosureCampaignId("");
      setDisclosureContributionId("");
      setDisclosureReason("");
      setPendingDisclosure(null);
      setTwoFactorCode("");
    } catch (err) {
      if (err instanceof API2FARequiredError) setPendingDisclosure({ campaignId, contributionId, reason });
      else alert(err instanceof APIError ? err.message : "Failed to request emergency disclosure");
    } finally {
      setRequestingDisclosure(false);
    }
  };

  const actions: (AdminDataAccessLogEntry["action"] | "ALL")[] = ["ALL", "VIEWED", "LABEL_GENERATED", "MESSAGE_SENT", "PROXY_CALL_STARTED", "COURIER_SHARED", "ACCESS_REVOKED", "ADMIN_OVERRIDE"];
  const filtered = actionFilter === "ALL" ? logs : logs.filter((l) => l.action === actionFilter);

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? <LoadingPanel label="Loading the data-access log..." /> : (
          <div className="space-y-8">
            <PageHeader
              title="Data access log"
              subtitle="Every supplier/admin view, message, label, proxy call, courier share, revocation and emergency override against participant delivery data — an append-only audit trail (spec §14, §15.8)."
              actions={<Button variant="ghost" disabled={refreshing} onClick={() => void load(true)}><Icon name="refresh" className="h-4 w-4" />{refreshing ? "Refreshing..." : "Refresh"}</Button>}
            />
            {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}

            <Card>
              <h2 className="text-2xl font-black">Emergency contact disclosure</h2>
              <p className="mt-2 text-sm text-slate-500">
                Reveals a participant&apos;s real phone number to the assigned supplier for a bounded window (spec §14.3, AT-42). Always requires a second, different admin&apos;s approval — this only creates the pending request.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <input placeholder="Campaign ID" value={disclosureCampaignId} onChange={(e) => setDisclosureCampaignId(e.target.value)} className="rounded-xl border border-slate-200 p-2 text-sm" />
                <input placeholder="Contribution ID" value={disclosureContributionId} onChange={(e) => setDisclosureContributionId(e.target.value)} className="rounded-xl border border-slate-200 p-2 text-sm" />
                <input placeholder="Reason (required)" value={disclosureReason} onChange={(e) => setDisclosureReason(e.target.value)} className="rounded-xl border border-slate-200 p-2 text-sm" />
              </div>
              <div className="mt-3 flex items-center justify-between">
                {disclosureMessage ? <p className="text-sm text-emerald-700">{disclosureMessage}</p> : <span />}
                <Button
                  variant="danger"
                  disabled={requestingDisclosure || !disclosureCampaignId.trim() || !disclosureContributionId.trim() || !disclosureReason.trim()}
                  onClick={() => void requestDisclosure()}
                >
                  Request disclosure
                </Button>
              </div>
            </Card>

            <Card>
              <h2 className="text-2xl font-black">Access log</h2>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <input
                  placeholder="Filter by campaign ID"
                  value={campaignIdFilter}
                  onChange={(e) => setCampaignIdFilter(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void load(); }}
                  className="w-72 rounded-xl border border-slate-200 p-2 text-sm"
                />
                <Button variant="secondary" onClick={() => void load()}>Search</Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {actions.map((a) => (
                  <button
                    key={a}
                    onClick={() => setActionFilter(a)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${actionFilter === a ? "bg-[#096B4A] text-white" : "bg-slate-100 text-slate-600"}`}
                  >
                    {a === "ALL" ? "All" : a.replace(/_/g, " ")}
                  </button>
                ))}
              </div>

              {filtered.length === 0 ? (
                <p className="mt-6 text-slate-500">No access events{campaignIdFilter ? ` for campaign ${campaignIdFilter}` : ""}.</p>
              ) : (
                <div className="mt-6 space-y-3">
                  {filtered.map((log) => (
                    <div key={log.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge tone={actionTone(log.action)}>{log.action.replace(/_/g, " ")}</Badge>
                            <Badge tone="gray">{log.dataCategory.replace(/_/g, " ")}</Badge>
                            <Badge tone="blue">{log.accessorRole}</Badge>
                          </div>
                          <p className="mt-2 text-sm text-slate-700">Campaign {log.campaignId}{log.contributionId ? ` · order ${log.contributionId}` : ""}</p>
                          <p className="text-xs text-slate-500">By {log.accessorUserId} — {log.purposeCode}</p>
                          {log.revokedAt ? <p className="mt-1 text-xs text-red-600">Revoked {new Date(log.revokedAt).toLocaleString()}{log.revocationReason ? ` — ${log.revocationReason}` : ""}</p> : null}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-slate-400">{new Date(log.accessedAt).toLocaleString()}</p>
                          {log.accessExpiresAt ? <p className="text-xs font-semibold text-amber-700">Expires {new Date(log.accessExpiresAt).toLocaleString()}</p> : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {pendingDisclosure ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
            <Card className="w-full max-w-md">
              <h3 className="text-xl font-black text-[#101820]">Enter 2FA code</h3>
              <p className="mt-2 text-sm text-slate-500">Confirm requesting emergency contact disclosure. A second, different admin must still approve it.</p>
              <input
                autoFocus
                inputMode="numeric"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                placeholder="6-digit code"
                className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none"
              />
              <div className="mt-4 flex gap-3">
                <Button
                  disabled={requestingDisclosure || !twoFactorCode.trim()}
                  onClick={() => void requestDisclosure(pendingDisclosure, twoFactorCode.trim())}
                  className="flex-1"
                >
                  Confirm
                </Button>
                <Button variant="ghost" className="flex-1" onClick={() => { setPendingDisclosure(null); setTwoFactorCode(""); }}>
                  Cancel
                </Button>
              </div>
            </Card>
          </div>
        ) : null}
      </AdminLayout>
    </ProtectedRoute>
  );
}
