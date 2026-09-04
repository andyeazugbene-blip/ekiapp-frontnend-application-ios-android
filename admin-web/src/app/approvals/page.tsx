"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, ErrorPanel, LoadingPanel } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { approvalsAPI, AdminApproval, AdminApprovalRule } from "@/lib/services/approvals.api";

/**
 * Four-eyes approvals (architecture doc §7/§15.2). A second, different
 * admin decides here — deciding APPROVE is also what executes the
 * original gated action (see the backend's adminDecideApproval). Rules
 * below control which action types are gated at all; with no rule an
 * action type is ungated and never reaches this queue.
 */
const KNOWN_ACTION_TYPES: { actionType: string; label: string; description: string }[] = [
  { actionType: "order.refund.large", label: "Large order refund", description: "Gates admin-initiated order refunds at or above the threshold." },
  { actionType: "community_buy.supplier_payment_release", label: "Community Buy supplier payment release", description: "Gates releasing a Community Buy supplier payment at or above the threshold." },
];

function formatAmount(amount: number | null, currency: string | null): string {
  if (amount == null) return "Any amount";
  return `${(currency ?? "").toUpperCase()} ${(amount / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;
}

export default function ApprovalsPage() {
  const [pending, setPending] = useState<AdminApproval[]>([]);
  const [rules, setRules] = useState<AdminApprovalRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [decidingApproval, setDecidingApproval] = useState<{ approval: AdminApproval; approve: boolean } | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [decideError, setDecideError] = useState("");

  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [ruleThreshold, setRuleThreshold] = useState("");
  const [ruleCurrency, setRuleCurrency] = useState("GBP");
  const [ruleEnabled, setRuleEnabled] = useState(true);
  const [ruleTwoFactorCode, setRuleTwoFactorCode] = useState("");
  const [ruleError, setRuleError] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [pendingItems, ruleItems] = await Promise.all([
        approvalsAPI.listPending(),
        approvalsAPI.listRules(),
      ]);
      setPending(pendingItems);
      setRules(ruleItems);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load approvals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const ruleFor = (actionType: string) => rules.find((r) => r.actionType === actionType) ?? null;

  const startEditRule = (actionType: string) => {
    const existing = ruleFor(actionType);
    setEditingRule(actionType);
    setRuleThreshold(existing?.thresholdAmount != null ? String(existing.thresholdAmount / 100) : "");
    setRuleCurrency(existing?.currency ?? "GBP");
    setRuleEnabled(existing?.enabled ?? true);
    setRuleTwoFactorCode("");
    setRuleError("");
  };

  const saveRule = async () => {
    if (!editingRule) return;
    try {
      setRuleError("");
      const thresholdAmount = ruleThreshold.trim() ? Math.round(Number(ruleThreshold) * 100) : null;
      if (ruleThreshold.trim() && !Number.isFinite(thresholdAmount)) {
        setRuleError("Threshold must be a number");
        return;
      }
      await approvalsAPI.upsertRule(editingRule, { thresholdAmount, currency: thresholdAmount != null ? ruleCurrency : null, enabled: ruleEnabled }, ruleTwoFactorCode);
      setEditingRule(null);
      await loadData();
    } catch (err) {
      setRuleError(err instanceof APIError ? err.message : "Failed to save rule");
    }
  };

  const openDecide = (approval: AdminApproval, approve: boolean) => {
    setDecidingApproval({ approval, approve });
    setDecisionNote("");
    setTwoFactorCode("");
    setDecideError("");
  };

  const confirmDecide = async () => {
    if (!decidingApproval) return;
    try {
      setBusyId(decidingApproval.approval.id);
      setDecideError("");
      await approvalsAPI.decide(decidingApproval.approval.id, decidingApproval.approve, decisionNote.trim() || undefined, twoFactorCode);
      setDecidingApproval(null);
      await loadData();
    } catch (err) {
      setDecideError(err instanceof APIError ? err.message : "Failed to decide");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? (
          <LoadingPanel label="Loading approvals..." />
        ) : (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[#101820]">Approvals</h1>
              <p className="text-[13px] text-slate-400">Four-eyes review — a different admin from the one who requested it must decide.</p>
            </div>

            {error && <ErrorPanel message={error} onRetry={() => void loadData()} />}

            <Card>
              <h2 className="text-base font-black text-[#101820]">Pending ({pending.length})</h2>
              {pending.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">Nothing is waiting on a second admin right now.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {pending.map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-100 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-bold text-[#101820]">{item.actionType}</p>
                          <p className="text-[12px] text-slate-500">{item.businessRefType} · {item.businessRefId}</p>
                          <p className="mt-1 text-[13px] font-semibold text-slate-700">{formatAmount(item.amount, item.currency)}</p>
                          <p className="mt-1 text-[12px] text-slate-500">Requested by {item.requestedBy?.name ?? item.requestedById}: &ldquo;{item.reason}&rdquo;</p>
                          <p className="mt-1 text-[11px] text-slate-400">{new Date(item.createdAt).toLocaleString("en-GB")}</p>
                        </div>
                        <div className="flex gap-2">
                          <button disabled={busyId === item.id} onClick={() => openDecide(item, true)} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-600 hover:bg-emerald-100 disabled:opacity-50">Approve</button>
                          <button disabled={busyId === item.id} onClick={() => openDecide(item, false)} className="rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-500 hover:bg-red-100 disabled:opacity-50">Reject</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <h2 className="text-base font-black text-[#101820]">Gated action types</h2>
              <p className="mt-1 text-[12px] text-slate-400">With no rule (or a disabled one), an action type is ungated and never reaches the queue above.</p>
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
                              : "Not gated — proceeds without a second admin"}
                          </p>
                        </div>
                        {!isEditing && (
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
                            <input value={ruleThreshold} onChange={(e) => setRuleThreshold(e.target.value)} placeholder="Threshold amount (blank = always gate)" className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none" />
                            <input value={ruleCurrency} onChange={(e) => setRuleCurrency(e.target.value.toUpperCase())} placeholder="GBP" maxLength={3} className="w-20 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none" />
                          </div>
                          <input value={ruleTwoFactorCode} onChange={(e) => setRuleTwoFactorCode(e.target.value)} placeholder="2FA code" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none" />
                          {ruleError && <p className="text-[12px] text-red-500">{ruleError}</p>}
                          <div className="flex gap-2">
                            <button onClick={() => void saveRule()} className="rounded-lg bg-[#096B4A] px-3 py-1.5 text-[11px] font-bold text-white">Save</button>
                            <button onClick={() => setEditingRule(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600">Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {decidingApproval && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
            <Card className="w-full max-w-md">
              <h3 className="text-xl font-black text-[#101820]">{decidingApproval.approve ? "Approve" : "Reject"} request</h3>
              <p className="mt-2 text-sm text-slate-500">
                {decidingApproval.approve
                  ? "Approving executes the original action immediately."
                  : "Rejecting leaves the original action un-executed."}
              </p>
              <textarea rows={2} value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} placeholder="Note (optional)" className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none" />
              <input value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value)} placeholder="2FA code" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none" />
              {decideError && <p className="mt-2 text-[12px] text-red-500">{decideError}</p>}
              <div className="mt-4 flex gap-3">
                <button disabled={busyId === decidingApproval.approval.id} onClick={() => void confirmDecide()} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 ${decidingApproval.approve ? "bg-[#096B4A]" : "bg-red-500"}`}>Confirm</button>
                <button onClick={() => setDecidingApproval(null)} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button>
              </div>
            </Card>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
