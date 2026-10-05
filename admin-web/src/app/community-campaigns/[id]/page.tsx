"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { Banner, ConfirmDialog, KeyValue, formatDateTime, formatMinor, useConfirm } from "@/components/AdminKit";
import { Badge, Button, Card, ErrorPanel, PageHeader } from "@/components/AdminUI";
import { NoAccess, SkeletonRows } from "@/components/PageStates";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  communityBuyAdminAPI, isPendingApproval,
  type AdminContribution, type AdminSupplierPayment, type CampaignAdminDetail, type CampaignStatus,
} from "@/lib/services/communityBuy.api";
import { marketLabel } from "@/lib/countries";
import { ReviewDecisionDialog } from "../ReviewDecisionDialog";

const STATUS_TONE: Record<CampaignStatus, "green" | "amber" | "red" | "blue" | "gray"> = {
  DRAFT: "gray", UNDER_REVIEW: "amber", CHANGES_REQUIRED: "amber", APPROVED: "blue", REJECTED: "red",
  LIVE: "blue", PAUSED: "gray", RESCUE_WINDOW: "amber", SUCCEEDED: "green", FAILED: "amber",
  REFUNDING: "amber", FULFILLING: "blue", COMPLETED: "green", FINANCIALLY_CLOSED: "gray", CANCELLED: "red",
  CANCELLATION_UNDER_REVIEW: "amber",
};
const STATUS_LABEL: Record<CampaignStatus, string> = {
  DRAFT: "Draft", UNDER_REVIEW: "Under review", CHANGES_REQUIRED: "Changes requested", APPROVED: "Approved",
  REJECTED: "Rejected", LIVE: "Live", PAUSED: "Paused", RESCUE_WINDOW: "Needs more participants",
  SUCCEEDED: "Target reached", FAILED: "Did not reach minimum", REFUNDING: "Refund processing", FULFILLING: "Fulfilment in progress",
  COMPLETED: "Completed", FINANCIALLY_CLOSED: "Financially closed", CANCELLED: "Ended",
  CANCELLATION_UNDER_REVIEW: "Cancellation under review",
};
const CANCELLABLE: CampaignStatus[] = ["LIVE", "PAUSED", "RESCUE_WINDOW"];
const REVIEW_STATUSES: CampaignStatus[] = ["UNDER_REVIEW", "CHANGES_REQUIRED"];
const labelClass = "text-xs font-bold uppercase tracking-wide text-slate-500";
const inputClass = "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#096B4A]";

/** Date shown in the campaign's own timezone when one is recorded, always with a zone label. */
function inCampaignZone(value: string | null | undefined, timezone: string | null | undefined): string {
  if (!value) return "Not set";
  if (!timezone) return formatDateTime(value);
  try {
    return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: timezone, timeZoneName: "short" });
  } catch {
    return formatDateTime(value);
  }
}

function Content() {
  const params = useParams<{ id: string }>();
  const { has, loading: permLoading } = usePermissions();
  const [detail, setDetail] = useState<CampaignAdminDetail | null>(null);
  const [contributions, setContributions] = useState<AdminContribution[]>([]);
  const [payment, setPayment] = useState<AdminSupplierPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<"approve" | "reject" | null>(null);
  const [issueNotes, setIssueNotes] = useState("");
  const [issueNotesSaved, setIssueNotesSaved] = useState(true);
  const [extendOpen, setExtendOpen] = useState(false);
  const [newDeadline, setNewDeadline] = useState("");
  const [messageOpen, setMessageOpen] = useState(false);
  const [msg, setMsg] = useState({ audience: "participants" as "participants" | "organiser" | "supplier" | "all", title: "", message: "" });
  const [dialogBusy, setDialogBusy] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const c = useConfirm();

  const load = useCallback(async (bypassCache = false) => {
    if (!params.id) return;
    const opts = bypassCache ? { bypassCache: true } : undefined;
    try {
      setLoading(true);
      setError("");
      const [d, contribs, payments] = await Promise.all([
        communityBuyAdminAPI.getCampaignAdminDetail(params.id, opts),
        communityBuyAdminAPI.getCampaignContributions(params.id, opts).catch(() => [] as AdminContribution[]),
        communityBuyAdminAPI.getSupplierPayments(opts).catch(() => [] as AdminSupplierPayment[]),
      ]);
      setDetail(d);
      setContributions(contribs);
      setPayment(payments.find((p) => p.campaignId === params.id) ?? null);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load this campaign");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (detail) { setIssueNotes(detail.campaign.adminIssueNotes ?? ""); setIssueNotesSaved(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.campaign.id]);

  if (!permLoading && !has("community_buy.read")) return <NoAccess what="Community Buy campaigns" />;
  if (loading && !detail) return <SkeletonRows count={6} />;
  if (error || !detail) return <ErrorPanel message={error || "Campaign not found"} onRetry={() => void load()} />;

  const campaign = detail.campaign;
  const { progress, money, operations, timeline } = detail;
  const canMutate = has("community_buy.mutate");
  const currency = campaign.currency;
  const done = async (message: string) => { setNotice(message); await load(true); };

  const saveIssueNotes = async () => {
    setBusy(true);
    try {
      await communityBuyAdminAPI.setCampaignIssueNotes(campaign.id, issueNotes.trim());
      setIssueNotesSaved(true);
      await done("Admin notes saved.");
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to save notes");
    } finally {
      setBusy(false);
    }
  };

  const publicUrl = campaign.slug ?? null;

  return (
    <div className="space-y-6">
      <Link href="/community-campaigns" className="text-sm font-bold text-[#096B4A] hover:underline">&larr; Community Buy campaigns</Link>
      <PageHeader
        title={campaign.title}
        subtitle={`${marketLabel(campaign.country, currency)} - created ${formatDateTime(campaign.createdAt)}`}
        actions={<Badge tone={STATUS_TONE[campaign.status]}>{STATUS_LABEL[campaign.status]}</Badge>}
      />
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      {/* Progress and money */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black">Progress</h2>
          <div className="mt-3" role="progressbar" aria-valuenow={progress.percentOfGoal ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label="Progress towards goal">
            <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-[#096B4A]" style={{ width: `${progress.percentOfGoal ?? 0}%` }} /></div>
            <p className="mt-1 text-sm font-semibold text-slate-700">{progress.percentOfGoal != null ? `${progress.percentOfGoal}% of goal` : "Goal not set"} - {progress.confirmedShares} of {progress.goalShares ?? "?"} shares</p>
          </div>
          <div className="mt-4"><KeyValue items={[
            { label: "Participants", value: progress.participantCount },
            { label: "Minimum / goal / maximum", value: `${progress.minimumShares ?? "-"} / ${progress.goalShares ?? "-"} / ${progress.maximumShares ?? "-"}` },
            { label: "Committed quantity", value: progress.committedQuantity },
            { label: "Paid quantity", value: progress.paidQuantity },
          ]} /></div>
        </Card>
        <Card>
          <h2 className="text-xl font-black">Money</h2>
          <div className="mt-4"><KeyValue items={[
            { label: "Pledged (not yet charged)", value: formatMinor(money.pledgedAmount, currency) },
            { label: "Paid", value: formatMinor(money.paidAmount, currency) },
            { label: "Refunded", value: `${formatMinor(money.refundedAmount, currency)} (${money.refundCount})` },
            { label: "Payment failures", value: money.paymentFailures },
            { label: "Supplier payment", value: money.supplierPayment ? `${formatMinor(money.supplierPayment.amount, money.supplierPayment.currency)} - ${money.supplierPayment.status.replace(/_/g, " ").toLowerCase()}` : "No record yet" },
            { label: "Organiser payout", value: money.organiserPayout ? `${formatMinor(money.organiserPayout.amount, currency)} - ${money.organiserPayout.status.replace(/_/g, " ").toLowerCase()}` : "No record yet" },
          ]} /></div>
        </Card>
      </div>

      {/* Identity, terms and timing */}
      <Card>
        <h2 className="mb-4 text-xl font-black">Campaign record</h2>
        <KeyValue items={[
          { label: "Organiser", value: campaign.organiser?.user ? `${campaign.organiser.user.name} (${campaign.organiser.user.email})` : "Not provided" },
          { label: "Fulfilment", value: campaign.fulfilmentOwner === "SELF" ? "Self-fulfilled by the organiser" : (campaign.supplier?.vendor?.storeName ?? campaign.supplierAccount?.user?.name ?? "Supplier not provided") + (campaign.supplierCommitted ? " (accepted)" : campaign.supplierDeclinedAt ? " (declined)" : " (awaiting response)") },
          { label: "Price per share", value: formatMinor(campaign.pricePerShareMinor, currency) },
          { label: "Public URL slug", value: publicUrl ?? "Assigned when the campaign is published" },
          { label: "Timezone", value: campaign.timezone ?? "Not set (dates shown in your local time)" },
          { label: "Deadline", value: inCampaignZone(campaign.deadline, campaign.timezone) },
          { label: "Payment deadline", value: inCampaignZone(campaign.paymentDeadline, campaign.timezone) },
          { label: "Fulfilment deadline", value: inCampaignZone(campaign.fulfilmentDeadline, campaign.timezone) },
          { label: "Scheduled opening", value: inCampaignZone(campaign.scheduledOpenAt, campaign.timezone) },
          { label: "Extensions used", value: campaign.extensionCount },
          ...(campaign.status === "RESCUE_WINDOW" && campaign.rescueEndsAt ? [{ label: "Rescue window ends", value: inCampaignZone(campaign.rescueEndsAt, campaign.timezone) }] : []),
          ...(campaign.reviewCriteria ? [{ label: "Review criteria", value: Object.entries(campaign.reviewCriteria).map(([k, v]) => `${k}: ${v ? "pass" : "fail"}`).join(", ") }] : []),
          ...(campaign.reviewNotes ? [{ label: "Review notes", value: campaign.reviewNotes }] : []),
        ]} />
      </Card>

      {/* Actions */}
      {canMutate ? (
        <Card>
          <h2 className="text-xl font-black">Actions</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {REVIEW_STATUSES.includes(campaign.status) ? (
              <>
                {campaign.status === "UNDER_REVIEW" ? <Button onClick={() => setReview("approve")}>Approve</Button> : null}
                <Button variant="secondary" onClick={() => c.ask(
                  { title: "Request changes", description: "The organiser is notified and can edit and resubmit.", confirmLabel: "Request changes", tone: "primary", reasonLabel: "What needs to change?" },
                  async (notes) => { await communityBuyAdminAPI.requestCampaignChanges(campaign.id, notes); await done("Changes requested."); },
                )}>Request changes</Button>
                {campaign.status === "UNDER_REVIEW" ? <Button variant="danger" onClick={() => setReview("reject")}>Reject</Button> : null}
              </>
            ) : null}
            {campaign.status === "LIVE" ? (
              <Button variant="danger" onClick={() => c.ask(
                { title: `Pause "${campaign.title}"?`, description: "No new contributions are accepted until resumed. The organiser, supplier and every participant are notified.", confirmLabel: "Pause campaign", reasonLabel: "Reason (shared with the organiser and supplier)" },
                async (reason) => { await communityBuyAdminAPI.pauseCampaign(campaign.id, reason); await done("Campaign paused and all parties notified."); },
              )}>Pause</Button>
            ) : null}
            {campaign.status === "PAUSED" ? (
              <Button variant="secondary" onClick={() => c.ask(
                { title: "Resume contributions?", confirmLabel: "Resume", tone: "primary", requireReason: false },
                async () => { await communityBuyAdminAPI.resumeCampaign(campaign.id); await done("Campaign resumed."); },
              )}>Resume</Button>
            ) : null}
            {campaign.status === "LIVE" || campaign.status === "RESCUE_WINDOW" ? (
              <Button variant="secondary" onClick={() => { setDialogError(""); setNewDeadline(""); setExtendOpen(true); }}>Extend deadline</Button>
            ) : null}
            <Button variant="ghost" onClick={() => { setDialogError(""); setMessageOpen(true); }}>Message participants, organiser or supplier</Button>
            {CANCELLABLE.includes(campaign.status) ? (
              <Button variant="danger" onClick={() => c.ask(
                { title: `End "${campaign.title}"?`, description: "Irreversible. The organiser and every participant are notified. No participant has been charged yet, so this only voids pledges. Requires 2FA.", confirmLabel: "End campaign", reasonLabel: "Reason (recorded and shared)" },
                async (reason) => { await communityBuyAdminAPI.cancelCampaign(campaign.id, reason); await done("Campaign ended."); },
              )}>End campaign</Button>
            ) : null}
          </div>
          {payment && payment.status !== "PAID" ? (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-500">Supplier payment - {formatMinor(payment.amount, payment.currency)} ({payment.status.replace(/_/g, " ").toLowerCase()}){payment.holdReason ? ` - hold: ${payment.holdReason}` : ""}</p>
              <div className="mt-2 flex flex-wrap gap-3">
                <Button onClick={() => c.ask(
                  { title: "Approve release to supplier?", description: `Release ${formatMinor(payment.amount, payment.currency)}. This cannot be undone. Large releases may need a second admin's approval. Requires 2FA.`, confirmLabel: "Approve release", tone: "primary", requireReason: false },
                  async () => {
                    const result = await communityBuyAdminAPI.releaseSupplierPayment(campaign.id);
                    await done(isPendingApproval(result) ? result.message : "Payment released.");
                  },
                )}>Approve release</Button>
                <Button variant="secondary" onClick={() => c.ask(
                  { title: "Place supplier payment on hold?", confirmLabel: "Place on hold", reasonLabel: "Hold reason" },
                  async (reason) => { await communityBuyAdminAPI.holdSupplierPayment(campaign.id, reason); await done("Payment placed on hold."); },
                )}>Place on hold</Button>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* Participants and payments */}
      <Card>
        <h2 className="mb-3 text-xl font-black">Participants and payments</h2>
        {contributions.length === 0 ? <p className="text-sm text-slate-500">No participants yet.</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs font-black uppercase tracking-wide text-slate-500">
                <tr><th scope="col" className="py-2 pr-4">Participant</th><th scope="col" className="py-2 pr-4">Quantity</th><th scope="col" className="py-2 pr-4">Amount</th><th scope="col" className="py-2 pr-4">Payment status</th><th scope="col" className="py-2">Refund</th></tr>
              </thead>
              <tbody>
                {contributions.map((ct) => (
                  <tr key={ct.id} className="border-t border-slate-100">
                    <td className="py-2 pr-4"><p className="font-bold text-[#101820]">{ct.participant.name || "Name not provided"}{ct.isOrganiserTopUp ? " (organiser top-up)" : ""}</p><p className="text-xs text-slate-500">{ct.participant.email}</p></td>
                    <td className="py-2 pr-4">{ct.quantity}</td>
                    <td className="py-2 pr-4">{formatMinor(ct.amount, ct.currency)}</td>
                    <td className="py-2 pr-4"><Badge tone={ct.status === "PAID" ? "green" : ct.status.includes("FAIL") ? "red" : "gray"}>{ct.status.replace(/_/g, " ").toLowerCase()}</Badge></td>
                    <td className="py-2 text-xs text-slate-600">{ct.refund ? `${ct.refund.status.replace(/_/g, " ").toLowerCase()} (${formatMinor(ct.refund.amount, ct.currency)})` : "None"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Operations */}
      <Card>
        <h2 className="text-xl font-black">Operations</h2>
        <div className="mt-3"><KeyValue items={[
          { label: "Fulfilment", value: operations.fulfilment ? `${operations.fulfilment.status.replace(/_/g, " ").toLowerCase()}${operations.fulfilment.method ? ` (${operations.fulfilment.method.toLowerCase()})` : ""}` : "Not started" },
          { label: "Open fulfilment alerts", value: operations.alerts.filter((a) => a.status === "OPEN").length },
          { label: "Support cases", value: operations.supportCases.length },
        ]} /></div>
        {operations.supportCases.length > 0 ? (
          <ul className="mt-3 space-y-1 text-sm">
            {operations.supportCases.map((s) => <li key={s.id} className="text-slate-600">{s.caseType.replace(/_/g, " ").toLowerCase()} - {s.status.replace(/_/g, " ").toLowerCase()} ({formatDateTime(s.createdAt)})</li>)}
          </ul>
        ) : null}
        <div className="mt-4 border-t border-slate-100 pt-4">
          <label className={labelClass} htmlFor="admin-notes">Admin notes (internal, stock and incident notes)</label>
          <textarea id="admin-notes" value={issueNotes} disabled={!canMutate} onChange={(e) => { setIssueNotes(e.target.value); setIssueNotesSaved(false); }} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm" rows={3} />
          {canMutate ? (
            <div className="mt-2 flex items-center gap-3">
              <Button variant="secondary" disabled={busy || issueNotesSaved} onClick={() => void saveIssueNotes()}>Save notes</Button>
              <span className="text-xs text-slate-400">{issueNotesSaved ? "Saved" : "Unsaved changes"}</span>
            </div>
          ) : null}
        </div>
      </Card>

      {/* Timeline */}
      <Card>
        <h2 className="mb-3 text-xl font-black">Timeline</h2>
        {timeline.length === 0 ? <p className="text-sm text-slate-500">No recorded activity yet.</p> : (
          <ol className="space-y-2">
            {timeline.map((t, i) => (
              <li key={`${t.at}-${i}`} className="rounded-xl border border-slate-100 p-3 text-sm">
                <p className="font-bold capitalize text-[#101820]">{t.label}</p>
                <p className="text-xs text-slate-500">{formatDateTime(t.at)}{t.kind === "fulfilment" ? " - fulfilment" : ""}</p>
                {t.detail ? <p className="mt-1 text-xs text-slate-600">{t.detail}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </Card>

      {c.dialog}
      {review ? <ReviewDecisionDialog mode={review} campaignId={campaign.id} campaignTitle={campaign.title} onClose={() => setReview(null)} onDone={done} /> : null}

      {extendOpen ? (
        <ConfirmDialog
          open
          title="Extend deadline"
          description="Participants, the organiser and the supplier are notified. Requires 2FA."
          confirmLabel="Extend deadline"
          tone="primary"
          reasonLabel="Reason (shared with participants and recorded in the audit log)"
          loading={dialogBusy}
          error={dialogError}
          onCancel={() => { if (!dialogBusy) setExtendOpen(false); }}
          onConfirm={async (reason) => {
            if (!newDeadline) { setDialogError("Choose the new deadline."); return; }
            setDialogBusy(true); setDialogError("");
            try {
              await communityBuyAdminAPI.extendCampaignDeadline(campaign.id, new Date(newDeadline).toISOString(), reason);
              setExtendOpen(false);
              await done("Deadline extended and participants notified.");
            } catch (err) {
              setDialogError(err instanceof Error ? err.message : "Failed to extend");
            } finally { setDialogBusy(false); }
          }}
        >
          <label className="block space-y-1"><span className={labelClass}>New deadline{campaign.timezone ? ` (${campaign.timezone})` : " (your local time)"}</span>
            <input className={inputClass} type="datetime-local" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} />
          </label>
          <p className="text-xs text-slate-500">Current deadline: {inCampaignZone(campaign.deadline, campaign.timezone)}</p>
        </ConfirmDialog>
      ) : null}

      {messageOpen ? (
        <ConfirmDialog
          open
          title="Send a message"
          description="Delivered in the app (and by email to the organiser or supplier). Audited and rate limited."
          confirmLabel="Send message"
          tone="primary"
          reasonLabel="Why are you sending this? (recorded in the audit log)"
          loading={dialogBusy}
          error={dialogError}
          onCancel={() => { if (!dialogBusy) setMessageOpen(false); }}
          onConfirm={async (reason) => {
            setDialogBusy(true); setDialogError("");
            try {
              const result = await communityBuyAdminAPI.messageCampaignAudience(campaign.id, { ...msg, reason });
              setMessageOpen(false);
              setMsg({ audience: "participants", title: "", message: "" });
              await done(`Message sent to ${result.sent.participants} participant(s), ${result.sent.organiser} organiser, ${result.sent.supplier} supplier.`);
            } catch (err) {
              setDialogError(err instanceof Error ? err.message : "Failed to send");
            } finally { setDialogBusy(false); }
          }}
        >
          <label className="block space-y-1"><span className={labelClass}>Send to</span>
            <select className={inputClass} value={msg.audience} onChange={(e) => setMsg((s) => ({ ...s, audience: e.target.value as typeof s.audience }))}>
              <option value="participants">All participants ({progress.participantCount})</option>
              <option value="organiser">Organiser</option>
              <option value="supplier">Supplier</option>
              <option value="all">Everyone involved</option>
            </select>
          </label>
          <label className="block space-y-1"><span className={labelClass}>Title</span>
            <input className={inputClass} maxLength={140} value={msg.title} onChange={(e) => setMsg((s) => ({ ...s, title: e.target.value }))} />
          </label>
          <label className="block space-y-1"><span className={labelClass}>Message</span>
            <textarea className={inputClass} rows={4} maxLength={2000} value={msg.message} onChange={(e) => setMsg((s) => ({ ...s, message: e.target.value }))} />
          </label>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

export default function CommunityCampaignDetailPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Content />
      </AdminLayout>
    </ProtectedRoute>
  );
}
