"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
import { Card, EmptyState, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import { Banner, formatDateTime, formatMinor, useConfirm } from "@/components/AdminKit";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { APIError } from "@/lib/api";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { approvalsAPI, AdminApproval, AdminApprovalRule } from "@/lib/services/approvals.api";

/**
 * Four-eyes approvals (architecture doc §7/§15.2). A second, different
 * admin decides here - deciding APPROVE is also what executes the
 * original gated action (see the backend's adminDecideApproval). Rules
 * below control which action types are gated at all; with no rule an
 * action type is ungated and never reaches this queue.
 *
 * Permissions (backend): queue = approvals.read, decide = approvals.decide,
 * rules list = roles.read, rules edit = roles.mutate. The rules card is only
 * requested when the admin holds roles.read, so Finance / Operations can still
 * open the queue.
 */
const KNOWN_ACTION_TYPES: { actionType: string; label: string; description: string }[] = [
  { actionType: "order.refund.large", label: "Large order refund", description: "Gates admin-initiated order refunds at or above the threshold." },
  { actionType: "community_buy.supplier_payment_release", label: "Community Buy supplier payment release", description: "Gates releasing a Community Buy supplier payment at or above the threshold." },
];
const ACTION_LABEL = Object.fromEntries(KNOWN_ACTION_TYPES.map((a) => [a.actionType, a.label]));

const REF_LABEL: Record<string, string> = {
  Order: "Order",
  CommunityContribution: "Community Buy contribution",
  CommunityBuyPaymentAuthorisation: "Community Buy payment authorisation",
  CampaignSupplierPayment: "Community Buy supplier payment",
};

function formatAmount(amount: number | null, currency: string | null): string {
  if (amount == null) return "Any amount";
  return formatMinor(amount, currency);
}

export default function ApprovalsPage() {
  const { user } = useAuth();
  const { has, loading: permLoading } = usePermissions();
  const canDecide = has("approvals.decide");
  const canSeeRules = has("roles.read");
  const canEditRules = has("roles.mutate");
  const confirm = useConfirm();

  const [pending, setPending] = useState<AdminApproval[]>([]);
  const [rules, setRules] = useState<AdminApprovalRule[]>([]);
  const [rulesError, setRulesError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [ruleThreshold, setRuleThreshold] = useState("");
  const [ruleCurrency, setRuleCurrency] = useState("GBP");
  const [ruleEnabled, setRuleEnabled] = useState(true);
  const [ruleError, setRuleError] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setPending(await approvalsAPI.listPending());
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load approvals");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void loadData(); }, [loadData]);

  const loadRules = useCallback(async () => {
    try {
      setRulesError("");
      setRules(await approvalsAPI.listRules());
    } catch (err) {
      setRulesError(err instanceof APIError ? err.message : "Failed to load approval rules");
    }
  }, []);
  useEffect(() => { if (canSeeRules) void loadRules(); }, [canSeeRules, loadRules]);

  const ruleFor = (actionType: string) => rules.find((r) => r.actionType === actionType) ?? null;

  const startEditRule = (actionType: string) => {
    const existing = ruleFor(actionType);
    setEditingRule(actionType);
    setRuleThreshold(existing?.thresholdAmount != null ? String(existing.thresholdAmount / 100) : "");
    setRuleCurrency(existing?.currency ?? "GBP");
    setRuleEnabled(existing?.enabled ?? true);
    setRuleError("");
  };

  const saveRule = () => {
    if (!editingRule) return;
    const thresholdAmount = ruleThreshold.trim() ? Math.round(Number(ruleThreshold) * 100) : null;
    if (ruleThreshold.trim() && (thresholdAmount == null || !Number.isFinite(thresholdAmount) || thresholdAmount < 0)) {
      setRuleError("Threshold must be a positive number");
      return;
    }
    setRuleError("");
    const actionType = editingRule;
    confirm.ask(
      {
        title: "Save approval rule?",
        tone: "primary",
        confirmLabel: "Save rule",
        description: `${ACTION_LABEL[actionType] ?? actionType}: ${ruleEnabled ? (thresholdAmount != null ? `gated at ${formatMinor(thresholdAmount, ruleCurrency)} and above` : "always gated") : "not gated (second admin no longer required)"}.`,
        requireReason: false,
      },
      async () => {
        await approvalsAPI.upsertRule(actionType, { thresholdAmount, currency: thresholdAmount != null ? ruleCurrency : null, enabled: ruleEnabled }, "");
        setEditingRule(null);
        setNotice("Approval rule saved.");
        await loadRules();
      },
    );
  };

  const decide = (item: AdminApproval, approve: boolean) => confirm.ask(
    {
      title: `${approve ? "Approve" : "Reject"} this request?`,
      tone: approve ? "primary" : "danger",
      confirmLabel: approve ? "Approve and execute" : "Reject request",
      description: `${ACTION_LABEL[item.actionType] ?? item.actionType} - ${formatAmount(item.amount, item.currency)}. ${approve ? "Approving executes the original action immediately." : "Rejecting leaves the original action un-executed."}`,
      reasonLabel: "Decision note (recorded in the audit log)",
    },
    async (note) => {
      await approvalsAPI.decide(item.id, approve, note, "");
      setNotice(approve ? "Approved. The original action has been executed." : "Rejected. The original action was not executed.");
      await loadData();
    },
  );

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <PageHeader title="Approvals" subtitle="Four-eyes review. A different admin from the one who requested it must decide." />

          {error && <ErrorPanel message={error} onRetry={() => void loadData()} />}
          {notice && <Banner tone="success">{notice}</Banner>}
          {!permLoading && !canDecide ? <Banner tone="info">Your role can view the queue but cannot approve or reject requests.</Banner> : null}

          {loading ? <LoadingPanel label="Loading approvals..." /> : (
            <Card>
              <h2 className="text-base font-black text-[#101820]">Pending ({pending.length})</h2>
              {pending.length === 0 ? (
                <div className="mt-3"><EmptyState title="Nothing is waiting on a second admin right now." /></div>
              ) : (
                <div className="mt-3 space-y-3">
                  {pending.map((item) => {
                    const own = Boolean(user?.id && item.requestedById === user.id);
                    return (
                      <div key={item.id} className="rounded-xl border border-slate-100 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-bold text-[#101820]">{ACTION_LABEL[item.actionType] ?? item.actionType}</p>
                            <p className="text-[12px] text-slate-500">
                              {REF_LABEL[item.businessRefType] ?? item.businessRefType}
                              {item.businessRefType === "Order" ? <> · <Link className="font-bold text-[#096B4A] hover:underline" href={`/orders/${item.businessRefId}`}>open order</Link></> : <> · ref {item.businessRefId.slice(-8)}</>}
                            </p>
                            <p className="mt-1 text-[13px] font-semibold text-slate-700">{formatAmount(item.amount, item.currency)}</p>
                            <p className="mt-1 text-[12px] text-slate-500">Requested by {item.requestedBy?.name || item.requestedBy?.email || "an admin"}: &ldquo;{item.reason}&rdquo;</p>
                            <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(item.createdAt)}</p>
                          </div>
                          {canDecide ? (
                            own ? (
                              <p className="max-w-[220px] text-[12px] font-semibold text-amber-700">You requested this. A second admin must decide.</p>
                            ) : (
                              <div className="flex gap-2">
                                <button onClick={() => decide(item, true)} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-600 hover:bg-emerald-100">Approve</button>
                                <button onClick={() => decide(item, false)} className="rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-500 hover:bg-red-100">Reject</button>
                              </div>
                            )
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {canSeeRules ? (
            <Card>
              <h2 className="text-base font-black text-[#101820]">Gated action types</h2>
              <p className="mt-1 text-[12px] text-slate-400">With no rule (or a disabled one), an action type is ungated and never reaches the queue above.</p>
              {rulesError ? <div className="mt-3"><ErrorPanel message={rulesError} onRetry={() => void loadRules()} /></div> : null}
              <div className="mt-3 space-y-3">
                {KNOWN_ACTION_TYPES.map(({ actionType, label, description }) => {
                  const rule = ruleFor(actionType);
                  const isEditing = editingRule === actionType;
                  return (
                    <div key={actionType} className="rounded-xl border border-slate-100 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-bold text-[#101820]">{label}</p>
                          <p className="text-[12px] text-slate-500">{description}</p>
                          <p className="mt-1 text-[12px] font-semibold text-slate-700">
                            {rule?.enabled
                              ? `Gated at ${formatAmount(rule.thresholdAmount, rule.currency)} and above`
                              : "Not gated. Proceeds without a second admin."}
                          </p>
                        </div>
                        {!isEditing && canEditRules && (
                          <button onClick={() => startEditRule(actionType)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50">
                            {rule ? "Edit rule" : "Set up rule"}
                          </button>
                        )}
                      </div>
                      {isEditing && (
                        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                          <label className="flex items-center gap-2 text-[13px] text-slate-700">
                            <input type="checkbox" checked={ruleEnabled} onChange={(e) => setRuleEnabled(e.target.checked)} />
                            Enabled
                          </label>
                          <div className="flex gap-2">
                            <input value={ruleThreshold} onChange={(e) => setRuleThreshold(e.target.value)} aria-label="Threshold amount" placeholder="Threshold amount (blank = always gate)" className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none" />
                            <input value={ruleCurrency} onChange={(e) => setRuleCurrency(e.target.value.toUpperCase())} aria-label="Currency code" placeholder="GBP" maxLength={3} className="w-20 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none" />
                          </div>
                          {ruleError && <p className="text-[12px] text-red-500">{ruleError}</p>}
                          <div className="flex gap-2">
                            <button onClick={saveRule} className="rounded-lg bg-[#096B4A] px-3 py-1.5 text-[11px] font-bold text-white">Save</button>
                            <button onClick={() => setEditingRule(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600">Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : null}
        </div>
        {confirm.dialog}
      </AdminLayout>
    </ProtectedRoute>
  );
}
