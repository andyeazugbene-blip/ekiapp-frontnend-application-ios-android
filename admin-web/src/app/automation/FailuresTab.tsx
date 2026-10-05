"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, EmptyState, ErrorPanel, LoadingPanel } from "@/components/AdminUI";
import { Banner, DataTable, formatDateTime, QueueTile, useConfirm, type Column } from "@/components/AdminKit";
import { APIError } from "@/lib/api";
import { automationAPI, type FailuresResponse, type PerformanceResponse } from "@/lib/services/automation.api";

const label = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export default function FailuresTab({ canMutate }: { canMutate: boolean }) {
  const [data, setData] = useState<FailuresResponse | null>(null);
  const [perf, setPerf] = useState<PerformanceResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const confirm = useConfirm();

  const load = useCallback(async () => {
    try {
      setLoading(true); setError("");
      const [f, p] = await Promise.all([automationAPI.failures(), automationAPI.performance()]);
      setData(f); setPerf(p);
    } catch (e) { setError(e instanceof APIError ? e.message : "Could not load failures"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (loading && !data) return <LoadingPanel label="Loading failures…" />;
  if (error) return <ErrorPanel message={error} onRetry={() => void load()} />;
  if (!data || !perf) return null;

  const count = (s: string) => perf.byStatus.find((x) => x.status === s)?.count ?? 0;
  const suppressedTotal = data.suppressedByReason.reduce((a, b) => a + b.count, 0);

  const retry = (id: string) => confirm.ask(
    { tone: "primary", title: "Retry this failed run?", description: "Creates a new attempt. Refused if it was already retried successfully, so no duplicate message is sent.", confirmLabel: "Retry" },
    async (reason) => { await automationAPI.retryRun(id, reason); await load(); },
  );

  const cols: Column<FailuresResponse["failedRuns"][number]>[] = [
    { key: "t", header: "When", render: (r) => <span className="whitespace-nowrap text-xs">{formatDateTime(r.createdAt)}</span> },
    { key: "a", header: "Automation", render: (r) => <span className="font-bold">{label(r.type)}</span> },
    { key: "r", header: "Recipient", render: (r) => r.recipient?.name ?? r.recipient?.email ?? "Not provided" },
    { key: "f", header: "Failure reason", render: (r) => <span className="text-xs">{r.failureReason ?? "No reason recorded"}{r.attempt > 1 ? ` (attempt ${r.attempt})` : ""}</span> },
    { key: "x", header: "", render: (r) => canMutate ? <Button variant="secondary" className="h-8 px-3" onClick={() => retry(r.id)}>Retry</Button> : null },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <QueueTile label="Runs (30d)" value={perf.byStatus.reduce((a, b) => a + b.count, 0)} hint="All real runs, tests excluded" tone="gray" />
        <QueueTile label="Handed to provider" value={count("SENT")} hint="Dispatched; delivery receipts shown per run" tone="blue" />
        <QueueTile label="Suppressed" value={count("SUPPRESSED")} hint="Correctly not sent" tone={count("SUPPRESSED") > 0 ? "amber" : "green"} />
        <QueueTile label="Failed" value={count("FAILED")} hint="Needs attention" tone={count("FAILED") > 0 ? "red" : "green"} href="/automation?tab=runs&status=FAILED" />
      </div>
      <Banner tone="info">{perf.note}</Banner>

      <section aria-labelledby="failed-h" className="space-y-2">
        <h2 id="failed-h" className="text-xl font-black">Failed runs (30 days)</h2>
        <DataTable columns={cols} rows={data.failedRuns} rowKey={(r) => r.id} emptyTitle="No failed automation runs in the last 30 days" />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black">Suppressed volume by reason</h2>
          {data.suppressedByReason.length === 0 ? <EmptyState title="Nothing suppressed in 30 days" /> : (
            <ul className="mt-4 space-y-2">
              {data.suppressedByReason.map((s) => (
                <li key={s.reason} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-2 text-sm">
                  <Link className="font-semibold hover:underline" href={`/automation?tab=runs&status=SUPPRESSED&reason=${encodeURIComponent(s.reason)}`}>{label(s.reason)}</Link>
                  <span className="font-black">{s.count}</span>
                </li>
              ))}
              <li className="px-4 text-xs text-slate-500">Total suppressed: {suppressedTotal}. One row is recorded per subject, reason and day.</li>
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="text-xl font-black">Provider errors on automation messages</h2>
          {data.providerErrors.length === 0 ? <EmptyState title="No provider errors recorded" /> : (
            <ul className="mt-4 space-y-2">
              {data.providerErrors.map((p) => (
                <li key={`${p.channel}-${p.detail}`} className="flex items-center justify-between rounded-xl border border-red-100 bg-red-50/40 px-4 py-2 text-sm">
                  <span><Badge tone="red">{label(p.channel)}</Badge> <span className="ml-2 text-slate-700">{p.detail}</span></span>
                  <span className="font-black">{p.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-black">Last successful run per automation</h2>
        {data.lastSuccessByRule.length === 0 ? <EmptyState title="No successful run recorded yet" /> : (
          <ul className="mt-4 grid gap-2 md:grid-cols-2">
            {data.lastSuccessByRule.map((l) => (
              <li key={l.ruleKey ?? "none"} className="flex justify-between rounded-xl border border-slate-100 px-4 py-2 text-sm">
                <span className="font-semibold">{l.ruleKey ? label(l.ruleKey) : "Unassigned"}</span>
                <span className="text-slate-500">{formatDateTime(l.lastSuccessAt)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-500">{data.note}</p>
      </Card>
      {confirm.dialog}
    </div>
  );
}
