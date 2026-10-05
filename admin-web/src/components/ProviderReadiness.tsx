"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, ErrorPanel } from "@/components/AdminUI";
import { Banner, ExternalLink, formatDateTime, timeAgo } from "@/components/AdminKit";
import { vendorsAPI } from "@/lib/services/vendors.api";
import { APIError } from "@/lib/api";
import { usePermissions } from "@/lib/hooks/usePermissions";
import type { ProviderIdentityState, ProviderReadiness, ProviderStage, VendorStripeStatus } from "@/types";

type Tone = "green" | "amber" | "red" | "blue" | "gray";

export const stageLabel: Record<ProviderStage, string> = {
  NOT_STARTED: "Not started",
  PENDING: "Pending",
  REQUIREMENTS_DUE: "Requirements due",
  RESTRICTED: "Restricted",
  VERIFIED: "Verified",
};

export const stageTone: Record<ProviderStage, Tone> = {
  NOT_STARTED: "gray",
  PENDING: "amber",
  REQUIREMENTS_DUE: "amber",
  RESTRICTED: "red",
  VERIFIED: "green",
};

const identityLabel: Record<ProviderIdentityState, string> = {
  NOT_STARTED: "Not started",
  PROCESSING: "Stripe reviewing",
  PENDING: "Awaiting vendor",
  NEEDS_INPUT: "Needs input",
  VERIFIED: "Verified",
  FAILED: "Failed - retry needed",
  CANCELED: "Canceled",
  REDACTED: "Redacted",
  LEGACY_MANUAL: "Legacy manual",
};

function identityTone(state: ProviderIdentityState): Tone {
  if (state === "VERIFIED") return "green";
  if (state === "NEEDS_INPUT" || state === "FAILED" || state === "CANCELED") return "red";
  if (state === "NOT_STARTED" || state === "REDACTED" || state === "LEGACY_MANUAL") return "gray";
  return "amber";
}

/** Three SEPARATE facts: a Verified identity never implies payments or payouts (handbook 5.1). */
export function ProviderBadges({ provider }: { provider?: ProviderReadiness }) {
  if (!provider) return <span className="text-xs font-semibold text-slate-400">Not available</span>;
  const hasAccount = Boolean(provider.connect.accountId);
  return (
    <div className="flex flex-wrap gap-1.5">
      <span title="Stripe Identity (KYC)"><Badge tone={identityTone(provider.identity.state)}>ID: {identityLabel[provider.identity.state]}</Badge></span>
      <span title="Can this vendor take card payments?"><Badge tone={provider.connect.chargesEnabled ? "green" : hasAccount ? "amber" : "gray"}>Charges {provider.connect.chargesEnabled ? "on" : "off"}</Badge></span>
      <span title="Can Stripe pay this vendor out?"><Badge tone={provider.connect.payoutsEnabled ? "green" : hasAccount ? "amber" : "gray"}>Payouts {provider.connect.payoutsEnabled ? "on" : "off"}</Badge></span>
    </div>
  );
}

export function ProviderStageBadge({ provider }: { provider?: ProviderReadiness }) {
  if (!provider) return null;
  return <Badge tone={stageTone[provider.stage]}>{stageLabel[provider.stage]}</Badge>;
}

export function ProviderReadinessView({
  data, onRefresh, onRemind, busy,
}: {
  data: VendorStripeStatus;
  onRefresh?: () => void;
  onRemind?: () => void;
  busy?: boolean;
}) {
  const due = [...data.connect.requirementsPastDue.map((k) => ({ k, past: true })), ...data.connect.requirementsCurrentlyDue.map((k) => ({ k, past: false }))];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={stageTone[data.stage]}>{stageLabel[data.stage]}</Badge>
        {data.pendingOn ? <Badge tone="blue">Waiting on {data.pendingOn === "PROVIDER" ? "Stripe" : "the vendor"}</Badge> : null}
        <span className="text-sm font-semibold text-slate-600">{data.summary}</span>
      </div>

      {data.refreshWarning ? <Banner tone="warning">{data.refreshWarning}</Banner> : null}

      <div className="grid gap-3 md:grid-cols-3">
        <Fact title="Identity (KYC)" tone={identityTone(data.identity.state)} value={identityLabel[data.identity.state]}
          sub={data.identity.verifiedAt ? `Verified ${formatDateTime(data.identity.verifiedAt)}` : data.identity.failureReason ?? undefined} />
        <Fact title="Card payments" tone={data.connect.chargesEnabled ? "green" : "amber"} value={data.connect.chargesEnabled ? "Charges enabled" : "Charges disabled"}
          sub={data.connect.accountId ? undefined : "No Stripe payout account yet"} />
        <Fact title="Payouts" tone={data.connect.payoutsEnabled ? "green" : "amber"} value={data.connect.payoutsEnabled ? "Payouts enabled" : "Payouts disabled"}
          sub={data.connect.status ? `Account status: ${data.connect.status}` : undefined} />
      </div>

      {data.connect.disabledReason ? (
        <Banner tone="danger" title="Stripe disabled reason">{data.connect.disabledReason}</Banner>
      ) : null}

      {due.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-black text-amber-900">Requirements due{data.connect.requirementsDeadline ? ` by ${formatDateTime(data.connect.requirementsDeadline)}` : ""}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.connect.requirementsCategories.map((c) => <Badge key={c} tone="amber">{c}</Badge>)}
          </div>
          <ul className="mt-2 list-disc pl-5 text-xs font-semibold text-amber-900">
            {due.map(({ k, past }) => <li key={k}>{k}{past ? " (past due)" : ""}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-500">
        <span>Last provider update: {data.connect.fetchedAt ? `${timeAgo(data.connect.fetchedAt)} (${formatDateTime(data.connect.fetchedAt)})` : data.identity.updatedAt ? formatDateTime(data.identity.updatedAt) : "Not yet received"}</span>
        {data.reminderLastSentAt ? <span>Reminder sent {timeAgo(data.reminderLastSentAt)}</span> : null}
        <ExternalLink href={data.links.account}>Open account in Stripe</ExternalLink>
        <ExternalLink href={data.links.identitySession}>Open identity session in Stripe</ExternalLink>
      </div>

      {(onRefresh || onRemind) && data.stage !== "VERIFIED" ? (
        <div className="flex flex-wrap gap-3">
          {onRefresh ? <Button variant="ghost" disabled={busy} onClick={onRefresh}>Refresh from Stripe</Button> : null}
          {onRemind ? <Button variant="secondary" disabled={busy} onClick={onRemind}>Send secure onboarding reminder</Button> : null}
        </div>
      ) : onRefresh ? (
        <Button variant="ghost" disabled={busy} onClick={onRefresh}>Refresh from Stripe</Button>
      ) : null}

      <p className="text-xs text-slate-400">
        Status updates arrive automatically from Stripe. Eki staff cannot approve or reject provider-controlled verification.
      </p>
    </div>
  );
}

function Fact({ title, value, sub, tone }: { title: string; value: string; sub?: string; tone: Tone }) {
  const ring = { green: "border-emerald-200", amber: "border-amber-200", red: "border-red-200", blue: "border-sky-200", gray: "border-slate-200" }[tone];
  return (
    <div className={`rounded-2xl border bg-white p-4 ${ring}`}>
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-1.5"><Badge tone={tone}>{value}</Badge></div>
      {sub ? <p className="mt-2 text-xs font-semibold text-slate-500">{sub}</p> : null}
    </div>
  );
}

/** Self-fetching panel for any admin page that knows a vendorId (vendor detail, user detail, ...). */
export function ProviderReadinessPanel({ vendorId, compact }: { vendorId: string; compact?: boolean }) {
  // Backend: stripe-reminder needs verification.mutate (status/refresh need vendors.read).
  const canRemind = usePermissions().has("verification.mutate");
  const [data, setData] = useState<VendorStripeStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async (refresh = false) => {
    try {
      setBusy(true); setError("");
      setData(await vendorsAPI.getStripeStatus(vendorId, refresh));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Could not load payment-provider status");
    } finally { setBusy(false); }
  }, [vendorId]);

  useEffect(() => { void load(); }, [load]);

  const remind = async () => {
    try {
      setBusy(true); setError(""); setNotice("");
      await vendorsAPI.sendStripeReminder(vendorId);
      setNotice("Reminder sent to the vendor.");
      await load();
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Could not send reminder");
    } finally { setBusy(false); }
  };

  const body = (
    <div className="space-y-3">
      {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {data ? (
        <ProviderReadinessView data={data} busy={busy} onRefresh={() => void load(true)} onRemind={canRemind ? () => void remind() : undefined} />
      ) : !error ? <p className="text-sm font-semibold text-slate-500">Loading provider status…</p> : null}
    </div>
  );
  if (compact) return body;
  return (
    <Card>
      <h3 className="mb-4 text-lg font-black text-[#101820]">Payment provider readiness</h3>
      {body}
    </Card>
  );
}

/** Compact stage + 3 separate badges from the list-row summary (no full readiness object needed). */
export function ProviderSummary({ summary }: { summary: { stage: ProviderStage; identityState: string; chargesEnabled: boolean; payoutsEnabled: boolean } }) {
  const hasAccount = summary.chargesEnabled || summary.payoutsEnabled || summary.stage === "REQUIREMENTS_DUE" || summary.stage === "RESTRICTED";
  const id = summary.identityState as ProviderIdentityState;
  return (
    <div className="space-y-1.5">
      <Badge tone={stageTone[summary.stage]}>{stageLabel[summary.stage]}</Badge>
      <div className="flex flex-wrap gap-1.5">
        <span title="Stripe Identity (KYC)"><Badge tone={identityTone(id)}>ID: {identityLabel[id] ?? summary.identityState}</Badge></span>
        <span title="Can this vendor take card payments?"><Badge tone={summary.chargesEnabled ? "green" : hasAccount ? "amber" : "gray"}>Charges {summary.chargesEnabled ? "on" : "off"}</Badge></span>
        <span title="Can Stripe pay this vendor out?"><Badge tone={summary.payoutsEnabled ? "green" : hasAccount ? "amber" : "gray"}>Payouts {summary.payoutsEnabled ? "on" : "off"}</Badge></span>
      </div>
    </div>
  );
}
