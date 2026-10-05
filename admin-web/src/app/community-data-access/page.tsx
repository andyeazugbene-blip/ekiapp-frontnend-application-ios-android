"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, Icon, LoadingPanel, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Banner, formatDateTime, useConfirm } from "@/components/AdminKit";
import { APIError } from "@/lib/api";
import { usePermissions } from "@/lib/hooks/usePermissions";
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
  const [disclosureMessage, setDisclosureMessage] = useState("");
  const confirm = useConfirm();
  // Backend: the log = community_buy.read; requesting a disclosure = community_buy.mutate (+2FA, prompted globally).
  const { has, loading: permLoading } = usePermissions();
  const canMutate = has("community_buy.mutate");

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, []);

  const requestDisclosure = () => {
    const campaignId = disclosureCampaignId.trim();
    const contributionId = disclosureContributionId.trim();
    const reason = disclosureReason.trim();
    if (!campaignId || !contributionId || !reason) return;
    setDisclosureMessage("");
    confirm.ask(
      {
        title: "Request emergency contact disclosure?",
        confirmLabel: "Request disclosure",
        description: "This only creates a request. A second, different admin must approve it, and the resulting access expires automatically. Requires a 2FA code.",
        requireReason: false,
      },
      async () => {
        const result = await communityBuyAdminAPI.requestEmergencyDisclosure(campaignId, contributionId, reason);
        setDisclosureMessage(result.message);
        setDisclosureCampaignId("");
        setDisclosureContributionId("");
        setDisclosureReason("");
      },
    );
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
            {!permLoading && !canMutate ? <Banner tone="info">Your role can read the access log but cannot request an emergency disclosure.</Banner> : null}

            {canMutate ? <Card>
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
                  disabled={!disclosureCampaignId.trim() || !disclosureContributionId.trim() || !disclosureReason.trim()}
                  onClick={requestDisclosure}
                >
                  Request disclosure
                </Button>
              </div>
            </Card> : null}

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

              <p className="mt-3 text-xs text-slate-400">The server returns the 100 most recent matching events (newest first); narrow by campaign ID to go further back. Names are not included by the log API, so entries link to the campaign and user record.</p>
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
                          <p className="mt-2 text-sm text-slate-700">
                            <Link className="font-bold text-[#096B4A] hover:underline" href={`/community-campaigns/${log.campaignId}`}>Open campaign</Link>
                            {log.contributionId ? <span className="text-slate-500"> · contribution ref {log.contributionId.slice(-8)}</span> : null}
                          </p>
                          <p className="text-xs text-slate-500">
                            Accessed by <Link className="font-semibold text-[#096B4A] hover:underline" href={`/users/${log.accessorUserId}`}>user profile</Link> — {log.purposeCode.replace(/_/g, " ").toLowerCase()}
                          </p>
                          {log.revokedAt ? <p className="mt-1 text-xs text-red-600">Revoked {formatDateTime(log.revokedAt)}{log.revocationReason ? ` — ${log.revocationReason}` : ""}</p> : null}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-slate-400">{formatDateTime(log.accessedAt)}</p>
                          {log.accessExpiresAt ? <p className="text-xs font-semibold text-amber-700">Expires {formatDateTime(log.accessExpiresAt)}</p> : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {confirm.dialog}
      </AdminLayout>
    </ProtectedRoute>
  );
}
