"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/AdminKit";
import { communityBuyAdminAPI } from "@/lib/services/communityBuy.api";

/** Handbook 10.3: campaigns are approved or rejected against recorded criteria. Keys must match the backend REVIEW_CRITERIA_KEYS. */
export const REVIEW_CRITERIA: Array<{ key: string; label: string }> = [
  { key: "productAccurate", label: "Product description and images are accurate" },
  { key: "priceFair", label: "Price and quantities are fair and clear" },
  { key: "termsClear", label: "Participation, refund and delivery terms are clear" },
  { key: "supplierOrSelfSupplyVerified", label: "Supplier (or self-supply) is verified and eligible" },
  { key: "deliveryPlanValid", label: "Delivery / collection plan is valid" },
  { key: "contentAppropriate", label: "Content is appropriate and policy compliant" },
];

export function ReviewDecisionDialog({
  mode, campaignId, campaignTitle, onClose, onDone,
}: { mode: "approve" | "reject"; campaignId: string; campaignTitle: string; onClose: () => void; onDone: (message: string) => void | Promise<void> }) {
  const [checked, setChecked] = useState<Record<string, boolean>>(() => Object.fromEntries(REVIEW_CRITERIA.map((c) => [c.key, false])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const allPassed = REVIEW_CRITERIA.every((c) => checked[c.key]);

  return (
    <ConfirmDialog
      open
      title={mode === "approve" ? `Approve "${campaignTitle}"?` : `Reject "${campaignTitle}"?`}
      description={mode === "approve"
        ? "Record the review criteria. Every criterion must pass to approve. The organiser is notified."
        : "Record which criteria failed and tell the organiser why. The organiser is notified."}
      confirmLabel={mode === "approve" ? "Approve campaign" : "Reject campaign"}
      tone={mode === "approve" ? "primary" : "danger"}
      reasonLabel={mode === "approve" ? "Decision notes (recorded in the audit log)" : "Rejection notes (shown to the organiser)"}
      loading={busy}
      error={error}
      onCancel={() => { if (!busy) onClose(); }}
      onConfirm={async (notes) => {
        if (mode === "approve" && !allPassed) { setError("Every review criterion must be ticked to approve."); return; }
        setBusy(true);
        setError("");
        try {
          if (mode === "approve") await communityBuyAdminAPI.approveCampaign(campaignId, checked, notes);
          else await communityBuyAdminAPI.rejectCampaign(campaignId, notes, checked);
          await onDone(mode === "approve" ? "Campaign approved." : "Campaign rejected.");
          onClose();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Action failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset className="space-y-2">
        <legend className="text-xs font-black uppercase tracking-wide text-slate-500">Review criteria (tick what passes)</legend>
        {REVIEW_CRITERIA.map((c) => (
          <label key={c.key} className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" className="mt-1" checked={checked[c.key] ?? false} onChange={(e) => setChecked((s) => ({ ...s, [c.key]: e.target.checked }))} />
            {c.label}
          </label>
        ))}
      </fieldset>
    </ConfirmDialog>
  );
}
