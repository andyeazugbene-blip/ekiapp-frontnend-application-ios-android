"use client";

import { Fragment, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import {
  ledgerAdminAPI,
  type LedgerBalance,
  type ReconciliationDifference,
  type ReconciliationRun,
} from "@/lib/services/ledger.api";

function money(minor: number, currency: string): string {
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const KIND_LABEL: Record<ReconciliationDifference["kind"], string> = {
  MISSING_LOCALLY: "Provider has it, we don't",
  MISSING_AT_PROVIDER: "We have it, provider doesn't",
  AMOUNT_MISMATCH: "Amount disagrees",
  STATUS_MISMATCH: "Status disagrees",
};

function DifferenceRow({ diff, onResolved }: { diff: ReconciliationDifference; onResolved: (updated: ReconciliationDifference) => void }) {
  const [resolving, setResolving] = useState(false);
  const [note, setNote] = useState("");
  const [showResolve, setShowResolve] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!note.trim()) {
      setError("A note is required to resolve a discrepancy.");
      return;
    }
    setResolving(true);
    setError("");
    try {
      onResolved(await ledgerAdminAPI.resolveDifference(diff.id, note.trim()));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Could not resolve this difference.");
    } finally {
      setResolving(false);
    }
  };

  return (
    <tr className="text-sm text-slate-700 align-top">
      <td className="px-4 py-3"><Badge tone={diff.status === "OPEN" ? "amber" : "green"}>{diff.status === "OPEN" ? "Open" : "Resolved"}</Badge></td>
      <td className="px-4 py-3">{KIND_LABEL[diff.kind]}</td>
      <td className="px-4 py-3">
        <span className="font-semibold text-[#101820]">{diff.businessRefType}</span>
        <span className="block text-xs text-slate-400">{diff.businessRefId}</span>
      </td>
      <td className="px-4 py-3 font-mono text-xs">{diff.providerRef ?? "—"}</td>
      <td className="px-4 py-3">{diff.expectedAmount != null ? (diff.expectedAmount / 100).toFixed(2) : "—"}</td>
      <td className="px-4 py-3">{diff.actualAmount != null ? (diff.actualAmount / 100).toFixed(2) : "—"}</td>
      <td className="px-4 py-3">
        {diff.status === "RESOLVED" ? (
          <span className="text-xs text-slate-500">{diff.note}</span>
        ) : showResolve ? (
          <div className="space-y-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why this is resolved..."
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-[#096B4A]"
            />
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => void submit()} disabled={resolving} className="!h-8 !px-3 !text-xs">
                {resolving ? "Saving..." : "Confirm"}
              </Button>
              <Button variant="ghost" onClick={() => setShowResolve(false)} className="!h-8 !px-3 !text-xs">Cancel</Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setShowResolve(true)} className="!h-8 !px-3 !text-xs">Resolve</Button>
        )}
      </td>
    </tr>
  );
}

export default function LedgerPage() {
  const [balances, setBalances] = useState<LedgerBalance[]>([]);
  const [runs, setRuns] = useState<ReconciliationRun[]>([]);
  const [differences, setDifferences] = useState<ReconciliationDifference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [provider, setProvider] = useState<"stripe" | "paystack">("stripe");
  const [periodStart, setPeriodStart] = useState(daysAgoIso(7));
  const [periodEnd, setPeriodEnd] = useState(todayIso());
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [expandedRun, setExpandedRun] = useState<ReconciliationRun | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [b, r, d] = await Promise.all([
        ledgerAdminAPI.getBalances(),
        ledgerAdminAPI.listRuns(),
        ledgerAdminAPI.listOpenDifferences(),
      ]);
      setBalances(b);
      setRuns(r);
      setDifferences(d);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Could not load the ledger.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const triggerRun = async () => {
    setRunning(true);
    setRunError("");
    try {
      const run = await ledgerAdminAPI.runReconciliation(provider, new Date(periodStart).toISOString(), new Date(`${periodEnd}T23:59:59.999Z`).toISOString());
      setRuns((prev) => [run, ...prev]);
      if (run.differences && run.differences.length > 0) {
        setDifferences((prev) => [...run.differences!.filter((d) => d.status === "OPEN"), ...prev]);
      }
    } catch (err) {
      setRunError(err instanceof APIError ? err.message : "Reconciliation run failed.");
    } finally {
      setRunning(false);
    }
  };

  const toggleRun = async (id: string) => {
    if (expandedRunId === id) {
      setExpandedRunId(null);
      setExpandedRun(null);
      return;
    }
    setExpandedRunId(id);
    setExpandedRun(null);
    try {
      setExpandedRun(await ledgerAdminAPI.getRun(id));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Could not load run detail.");
    }
  };

  const markResolvedEverywhere = (updated: ReconciliationDifference) => {
    setDifferences((prev) => prev.filter((d) => d.id !== updated.id));
    setExpandedRun((prev) => prev && prev.differences
      ? { ...prev, differences: prev.differences.map((d) => (d.id === updated.id ? updated : d)) }
      : prev);
  };

  const balancesByCurrency = balances.reduce<Record<string, LedgerBalance[]>>((acc, b) => {
    (acc[b.currency] ??= []).push(b);
    return acc;
  }, {});

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-8">
          <PageHeader
            title="Ledger Reconciliation"
            subtitle="The real double-entry ledger — every balance below is summed live from LedgerEntry rows, never a cached or estimated number. Reconciliation compares local records against Stripe's own transaction list for a period."
          />

          {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}

          {loading ? (
            <LoadingPanel label="Loading ledger..." />
          ) : (
            <>
              <Card>
                <h2 className="text-base font-bold text-[#101820]">Account balances</h2>
                <p className="mt-1 text-sm text-slate-500">Computed as sum(credits) − sum(debits) per account, grouped by currency.</p>
                {balances.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">No ledger accounts exist yet — they&apos;re created lazily on the first posted entry.</p>
                ) : (
                  <div className="mt-4 space-y-6">
                    {Object.entries(balancesByCurrency).map(([currency, rows]) => (
                      <div key={currency} className="overflow-x-auto">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{currency}</p>
                        <table className="min-w-full divide-y divide-slate-200">
                          <thead>
                            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                              <th className="px-4 py-2">Account type</th>
                              <th className="px-4 py-2">Owner</th>
                              <th className="px-4 py-2">Entries</th>
                              <th className="px-4 py-2">Balance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {rows.map((b) => (
                              <tr key={b.id} className="text-sm text-slate-700">
                                <td className="px-4 py-2 font-semibold text-[#101820]">{b.type}</td>
                                <td className="px-4 py-2">{b.ownerType}{b.ownerId ? ` · ${b.ownerId}` : ""}</td>
                                <td className="px-4 py-2">{b.entryCount}</td>
                                <td className="px-4 py-2 font-semibold">{money(b.balance, currency)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <h2 className="text-base font-bold text-[#101820]">Run a reconciliation</h2>
                <p className="mt-1 text-sm text-slate-500">Fetches the provider&apos;s real transaction list for the period and compares it against local records. Read-only against the provider — writes only to the reconciliation tables. Max 31 days per run.</p>
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <label className="space-y-1">
                    <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">Provider</span>
                    <select value={provider} onChange={(e) => setProvider(e.target.value as "stripe" | "paystack")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#096B4A]">
                      <option value="stripe">Stripe</option>
                      <option value="paystack">Paystack (not yet implemented)</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">From</span>
                    <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#096B4A]" />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">To</span>
                    <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#096B4A]" />
                  </label>
                  <Button variant="primary" onClick={() => void triggerRun()} disabled={running}>
                    {running ? "Running..." : "Run reconciliation"}
                  </Button>
                </div>
                {runError ? <p className="mt-2 text-sm text-red-600">{runError}</p> : null}
              </Card>

              <Card>
                <h2 className="text-base font-bold text-[#101820]">Reconciliation runs</h2>
                {runs.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">No reconciliation has ever been run yet.</p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead>
                        <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <th className="px-4 py-2">Provider</th>
                          <th className="px-4 py-2">Period</th>
                          <th className="px-4 py-2">Status</th>
                          <th className="px-4 py-2">Checked</th>
                          <th className="px-4 py-2">Differences</th>
                          <th className="px-4 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {runs.map((r) => (
                          <Fragment key={r.id}>
                            <tr className="text-sm text-slate-700">
                              <td className="px-4 py-3 font-semibold text-[#101820] capitalize">{r.provider}</td>
                              <td className="px-4 py-3">{new Date(r.periodStart).toLocaleDateString()} – {new Date(r.periodEnd).toLocaleDateString()}</td>
                              <td className="px-4 py-3">
                                <Badge tone={r.status === "COMPLETED" ? "green" : r.status === "FAILED" ? "red" : "amber"}>{r.status}</Badge>
                              </td>
                              <td className="px-4 py-3">{r.totalChecked}</td>
                              <td className="px-4 py-3">{r._count?.differences ?? "—"}</td>
                              <td className="px-4 py-3">
                                <Button variant="ghost" onClick={() => void toggleRun(r.id)} className="!h-8 !px-3 !text-xs">
                                  {expandedRunId === r.id ? "Hide" : "View"}
                                </Button>
                              </td>
                            </tr>
                            {expandedRunId === r.id ? (
                              <tr>
                                <td colSpan={6} className="bg-slate-50 px-4 py-4">
                                  {!expandedRun ? (
                                    <p className="text-sm text-slate-500">Loading...</p>
                                  ) : expandedRun.differences && expandedRun.differences.length > 0 ? (
                                    <div className="overflow-x-auto">
                                      <table className="min-w-full divide-y divide-slate-200">
                                        <thead>
                                          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            <th className="px-4 py-2">Status</th>
                                            <th className="px-4 py-2">Kind</th>
                                            <th className="px-4 py-2">Record</th>
                                            <th className="px-4 py-2">Provider ref</th>
                                            <th className="px-4 py-2">Expected</th>
                                            <th className="px-4 py-2">Actual</th>
                                            <th className="px-4 py-2" />
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {expandedRun.differences.map((d) => (
                                            <DifferenceRow key={d.id} diff={d} onResolved={markResolvedEverywhere} />
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-slate-500">No discrepancies — every local record matched the provider.</p>
                                  )}
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <Card>
                <h2 className="text-base font-bold text-[#101820]">Unresolved discrepancies (all runs)</h2>
                {differences.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">Nothing open. Every recorded difference has been resolved.</p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead>
                        <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <th className="px-4 py-2">Status</th>
                          <th className="px-4 py-2">Kind</th>
                          <th className="px-4 py-2">Record</th>
                          <th className="px-4 py-2">Provider ref</th>
                          <th className="px-4 py-2">Expected</th>
                          <th className="px-4 py-2">Actual</th>
                          <th className="px-4 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {differences.map((d) => (
                          <DifferenceRow key={d.id} diff={d} onResolved={markResolvedEverywhere} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
