"use client";


import { Badge } from "@/components/AdminUI";
import { useConfirm } from "@/components/AdminKit";
import { communityBuyAdminAPI, type AdminSupplierAccount, type SupplierStatuses } from "@/lib/services/communityBuy.api";

type Tone = "green" | "amber" | "red" | "blue" | "gray";

const APPLICATION_LABEL: Record<SupplierStatuses["application"], [string, Tone]> = {
  DRAFT: ["Draft", "gray"],
  UNDER_REVIEW: ["Under review", "amber"],
  VERIFICATION_REQUIRED: ["Verification required", "amber"],
  INFORMATION_REQUIRED: ["Information requested", "amber"],
  APPROVED: ["Approved", "green"],
  REJECTED: ["Rejected", "red"],
};
const ACCOUNT_LABEL: Record<SupplierStatuses["account"], [string, Tone]> = {
  NOT_ACTIVE: ["Not active", "gray"],
  ACTIVE: ["Active", "green"],
  PAUSED: ["Paused", "blue"],
  RESTRICTED: ["Restricted", "red"],
  SUSPENDED: ["Suspended", "red"],
  CLOSED: ["Closed", "gray"],
};
const PAYOUT_LABEL: Record<SupplierStatuses["payout"], [string, Tone]> = {
  READY: ["Payouts ready", "green"],
  REQUIREMENTS_DUE: ["Payout setup incomplete", "amber"],
  NOT_STARTED: ["Payout setup not started", "gray"],
};

export function ApplicationBadge({ status }: { status?: SupplierStatuses["application"] }) {
  if (!status) return <Badge tone="gray">Unknown</Badge>;
  const [label, tone] = APPLICATION_LABEL[status];
  return <Badge tone={tone}>{label}</Badge>;
}
export function AccountBadge({ status }: { status?: SupplierStatuses["account"] }) {
  if (!status) return <Badge tone="gray">Unknown</Badge>;
  const [label, tone] = ACCOUNT_LABEL[status];
  return <Badge tone={tone}>{label}</Badge>;
}
export function PayoutBadge({ status }: { status?: SupplierStatuses["payout"] }) {
  if (!status) return <Badge tone="gray">Unknown</Badge>;
  const [label, tone] = PAYOUT_LABEL[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export const STATE_LABELS: Record<string, string> = {
  NOT_STARTED: "Not started",
  DRAFT: "Draft",
  VERIFICATION_REQUIRED: "Verification required",
  UNDER_REVIEW: "Under review",
  INFORMATION_REQUIRED: "Information requested",
  APPROVED: "Approved",
  PAUSED: "Paused",
  RESTRICTED: "Restricted",
  SUSPENDED: "Suspended",
  REJECTED: "Rejected",
  CLOSED: "Closed",
};

const PENDING = ["UNDER_REVIEW", "INFORMATION_REQUIRED", "VERIFICATION_REQUIRED"];

/** Which actions are valid for a state. Suspend is never offered on a pending application (handbook 14.11). */
export function availableActions(a: Pick<AdminSupplierAccount, "supplierState">) {
  const s = a.supplierState;
  return {
    approve: s === "UNDER_REVIEW" || s === "INFORMATION_REQUIRED",
    reject: PENDING.includes(s),
    requestInfo: s === "UNDER_REVIEW" || s === "INFORMATION_REQUIRED" || s === "VERIFICATION_REQUIRED",
    restrict: s === "APPROVED" || s === "PAUSED",
    unrestrict: s === "RESTRICTED",
    suspend: s === "APPROVED" || s === "PAUSED" || s === "RESTRICTED",
    unsuspend: s === "SUSPENDED",
    revokeAccess: s === "SUSPENDED" || s === "RESTRICTED",
    close: ["APPROVED", "PAUSED", "RESTRICTED", "SUSPENDED"].includes(s),
  };
}

/**
 * All supplier-account mutations behind ConfirmDialog with a required reason.
 * 2FA-gated routes are handled by the global 2FA prompter in api.ts.
 */
export function useSupplierActions(onDone: (message: string) => void | Promise<void>) {
  const c = useConfirm();
  const label = (a: AdminSupplierAccount) => a.user?.name ?? a.user?.email ?? "this supplier";

  return {
    dialog: c.dialog,
    approve: (a: AdminSupplierAccount) =>
      c.ask(
        { title: `Approve ${label(a)}?`, description: "They become selectable for Community Buy campaigns once payouts are ready. The supplier is notified by app and email.", confirmLabel: "Approve", tone: "primary", reasonLabel: "Approval note (recorded in the audit log)" },
        async (reason) => { await communityBuyAdminAPI.approveSupplierAccount(a.id, reason); await onDone("Supplier approved."); },
      ),
    reject: (a: AdminSupplierAccount) =>
      c.ask(
        { title: `Reject ${label(a)}'s application?`, description: "The supplier is notified by app and email with this reason.", confirmLabel: "Reject application", reasonLabel: "Reason shown to the supplier" },
        async (reason) => { await communityBuyAdminAPI.rejectSupplierAccount(a.id, reason); await onDone("Application rejected."); },
      ),
    requestInfo: (a: AdminSupplierAccount) =>
      c.ask(
        { title: `Request information from ${label(a)}`, description: "The supplier is notified and can resubmit their application.", confirmLabel: "Send request", tone: "primary", reasonLabel: "What information is needed?" },
        async (reason) => { await communityBuyAdminAPI.requestSupplierInformation(a.id, reason); await onDone("Information requested."); },
      ),
    restrict: (a: AdminSupplierAccount) => {
      let preserve = false;
      c.ask(
        {
          title: `Restrict ${label(a)}?`,
          description: "A restricted supplier cannot take on new campaigns. By default this also revokes access to participant delivery data across every assigned campaign.",
          confirmLabel: "Restrict",
          children: (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" onChange={(e) => { preserve = e.target.checked; }} />
              Preserve fulfilment access for campaigns already in progress
            </label>
          ),
        },
        async (reason) => { await communityBuyAdminAPI.restrictSupplierAccount(a.id, reason, preserve ? "fulfilment_access_preserved" : undefined); await onDone("Supplier restricted."); },
      );
    },
    unrestrict: (a: AdminSupplierAccount) =>
      c.ask(
        { title: "Lift restriction?", description: "The account returns to its prior approved state.", confirmLabel: "Lift restriction", tone: "primary" },
        async () => { await communityBuyAdminAPI.unrestrictSupplierAccount(a.id); await onDone("Restriction lifted."); },
      ),
    suspend: (a: AdminSupplierAccount) =>
      c.ask(
        { title: `Suspend ${label(a)}?`, description: "Immediately and atomically revokes access to participant delivery data across every assigned campaign. Requires 2FA.", confirmLabel: "Suspend account" },
        async (reason) => { await communityBuyAdminAPI.suspendSupplierAccount(a.id, reason); await onDone("Supplier suspended."); },
      ),
    unsuspend: (a: AdminSupplierAccount) =>
      c.ask(
        { title: "Lift suspension?", description: "The account returns to its prior approved state. Requires 2FA.", confirmLabel: "Lift suspension", tone: "primary" },
        async () => { await communityBuyAdminAPI.unsuspendSupplierAccount(a.id); await onDone("Suspension lifted."); },
      ),
    close: (a: AdminSupplierAccount) =>
      c.ask(
        { title: `Close ${label(a)}'s account?`, description: "Closing is final: the supplier can no longer be assigned. Their history, campaigns and records are retained. Requires 2FA.", confirmLabel: "Close account" },
        async (reason) => { await communityBuyAdminAPI.closeSupplierAccount(a.id, reason); await onDone("Account closed. History retained."); },
      ),
    revokeAccess: (a: AdminSupplierAccount) =>
      c.ask(
        { title: "Revoke data access now?", description: "Cuts this supplier's access to participant delivery data on every assigned campaign. Requires 2FA.", confirmLabel: "Revoke access" },
        async (reason) => {
          const { revokedCount } = await communityBuyAdminAPI.revokeSupplierDataAccess(a.id, reason);
          await onDone(`Revoked data access for ${revokedCount} campaign${revokedCount === 1 ? "" : "s"}.`);
        },
      ),
  };
}
