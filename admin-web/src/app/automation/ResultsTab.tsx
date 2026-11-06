"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, EmptyState, ErrorPanel, LoadingPanel } from "@/components/AdminUI";
import { Banner, DataTable, formatMinor, QueueTile, type Column } from "@/components/AdminKit";
import { APIError } from "@/lib/api";
import { automationAPI, type AttributionResponse } from "@/lib/services/automation.api";

const label = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export default function ResultsTab({ vendorId }: { vendorId?: string }) {
  const [data, setData] = useState<AttributionResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true); setError("");
      setData(await automationAPI.attribution(vendorId));
    } catch (e) { setError(e instanceof APIError ? e.message : "Could not load results"); }
    finally { setLoading(false); }
  }, [vendorId]);
  useEffect(() => { void load(); }, [load]);

  if (loading && !data) return <LoadingPanel label="Loading results…" />;
  if (error) return <ErrorPanel message={error} onRetry={() => void load()} />;
  if (!data) return null;

  const orders = data.assisted.reduce((sum, row) => sum + row.orders, 0);
  const recovered = data.subscriptionRecovery.reduce((sum, row) => sum + row.count, 0);

  const cols: Column<AttributionResponse["assisted"][number]>[] = [
    { key: "a", header: "Automation", render: (r) => <span className="font-bold">{label(r.type)}</span> },
    { key: "o", header: "Orders", render: (r) => r.orders },
    { key: "g", header: "Assisted revenue", render: (r) => formatMinor(r.gross, r.currency) },
    { key: "r", header: "Refunds", render: (r) => formatMinor(r.refunds, r.currency) },
    { key: "n", header: "Net", render: (r) => <span className="font-bold">{formatMinor(r.net, r.currency)}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <QueueTile label={`Buyers reached (${data.reportDays}d)`} value={data.buyersReached} hint={`${data.runsConsidered} automations sent`} tone="green" />
        <QueueTile label="Assisted orders" value={orders} hint={`Within ${data.windowDays} days of an automation`} tone="green" />
        <QueueTile label="Renewals recovered" value={recovered} hint="Failed, then paid" tone="green" />
        {data.qualifiedReferrals !== null ? <QueueTile label="Qualified referrals" value={data.qualifiedReferrals} hint="Met the approved conditions" tone="green" /> : null}
      </div>

      <Banner tone="info">
        {data.notes.assisted} <Link className="font-bold underline" href="/settings?tab=launch">Change the window</Link>
      </Banner>
      {data.runsCapped ? <Banner tone="warning">Only the most recent {data.runsConsidered} automations are included, so these figures may be low.</Banner> : null}

      <section aria-labelledby="assisted-h" className="space-y-2">
        <h2 id="assisted-h" className="text-xl font-black">Automation-assisted revenue</h2>
        {data.assisted.length === 0
          ? <EmptyState title="No assisted orders yet. They show here once a buyer orders after an automation reaches them." />
          : <DataTable columns={cols} rows={data.assisted} rowKey={(r) => `${r.type}:${r.currency}`} />}
        <p className="text-xs text-slate-500">{data.notes.net}</p>
      </section>

      <section aria-labelledby="recovery-h" className="space-y-2">
        <h2 id="recovery-h" className="text-xl font-black">Subscription recovery</h2>
        <Card className="space-y-1 p-4">
          {data.subscriptionRecovery.length === 0
            ? <p className="text-sm text-slate-600">No renewals recovered in this period.</p>
            : data.subscriptionRecovery.map((row) => (
              <p key={row.currency} className="text-sm"><span className="font-bold">{row.count}</span> renewals, {formatMinor(row.amount, row.currency)}</p>
            ))}
          <p className="text-xs text-slate-500">{data.notes.recovery}</p>
        </Card>
      </section>

      <section aria-labelledby="incremental-h" className="space-y-2">
        <h2 id="incremental-h" className="text-xl font-black">Estimated incremental revenue</h2>
        <Card className="p-4"><p className="text-sm text-slate-600">{data.notes.incremental}</p></Card>
      </section>
    </div>
  );
}
