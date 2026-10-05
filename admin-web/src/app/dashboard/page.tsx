"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, PageHeader } from "@/components/AdminUI";
import { Banner, QueueTile, formatDateTime, formatMinor, timeAgo } from "@/components/AdminKit";
import { NoAccess, SkeletonRows, SkeletonTiles } from "@/components/PageStates";
import ProtectedRoute from "@/components/ProtectedRoute";
import { convertMoney, useCurrency } from "@/contexts/CurrencyContext";
import { useActionCentre } from "@/lib/hooks/useActionCentre";
import { ActionSection, MoneyByCurrency, Severity } from "@/lib/services/dashboard.api";

const SEVERITY_STYLE: Record<Severity, { bar: string; label: string; tone: "red" | "amber" | "blue" | "gray" | "green" }> = {
  critical: { bar: "bg-red-600", label: "Critical", tone: "red" },
  high: { bar: "bg-red-500", label: "High", tone: "red" },
  medium: { bar: "bg-amber-400", label: "Medium", tone: "amber" },
  low: { bar: "bg-sky-400", label: "Low", tone: "blue" },
  ok: { bar: "bg-emerald-400", label: "Clear", tone: "green" },
};

const TILE_TONE: Record<Severity, "red" | "amber" | "blue" | "green"> = {
  critical: "red", high: "red", medium: "amber", low: "blue", ok: "green",
};

function ValueChips({ values }: { values: MoneyByCurrency[] }) {
  if (!values.length) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {values.map((v) => (
        <span key={v.currency} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700" title={`${v.count} item(s) in ${v.currency}`}>
          {formatMinor(v.amountMinor, v.currency)}
        </span>
      ))}
    </span>
  );
}

function AttentionRow({ section, onRetry }: { section: ActionSection; onRetry: () => void }) {
  const sev = SEVERITY_STYLE[section.severity];
  if (section.state === "unavailable") {
    return (
      <li className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <span className="h-10 w-1.5 rounded-full bg-slate-300" />
        <div className="min-w-0 flex-1">
          <p className="font-black text-[#101820]">{section.title}</p>
          <p className="text-sm font-semibold text-slate-500">Data unavailable</p>
        </div>
        <Button variant="ghost" className="h-9 px-3" onClick={onRetry}>Retry</Button>
      </li>
    );
  }
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:shadow-md">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 h-10 w-1.5 shrink-0 rounded-full ${sev.bar}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={section.href} className="text-base font-black text-[#101820] hover:text-[#096B4A]">{section.title}</Link>
            <Badge tone={sev.tone}>{sev.label}</Badge>
            {section.oldestAt ? <span className="text-xs font-semibold text-slate-500" title={formatDateTime(section.oldestAt)}>Oldest {timeAgo(section.oldestAt)}</span> : null}
          </div>
          <p className="mt-0.5 text-sm text-slate-500">{section.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <ValueChips values={section.values} />
            {section.breakdown.filter((b) => b.count > 0).slice(0, 4).map((b) => (
              b.href
                ? <Link key={b.label} href={b.href} className="text-xs font-semibold text-slate-600 hover:text-[#096B4A] hover:underline">{b.label}: <b>{b.count}</b></Link>
                : <span key={b.label} className="text-xs font-semibold text-slate-600">{b.label}: <b>{b.count}</b></span>
            ))}
          </div>
          {section.items.length ? (
            <ul className="mt-2 space-y-0.5">
              {section.items.slice(0, 3).map((it) => (
                <li key={`${it.href}-${it.title}`} className="truncate text-xs text-slate-500">
                  <Link href={it.href} className="font-bold text-slate-700 hover:text-[#096B4A] hover:underline">{it.title}</Link>
                  {it.subtitle ? <> — {it.subtitle}</> : null}
                </li>
              ))}
            </ul>
          ) : null}
          {section.note ? <p className="mt-2 text-xs text-slate-400">{section.note}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="text-3xl font-black leading-none text-[#101820]">{section.count}</span>
          <Link href={section.href} className="text-sm font-bold text-[#096B4A] hover:underline">Open →</Link>
        </div>
      </div>
    </li>
  );
}

function tileHint(s: ActionSection) {
  if (s.state === "not_monitored") return "Not monitored";
  if (s.count === 0 && s.key === "systemHealth") return s.breakdown[0] ? `${s.breakdown[0].label}: ${s.breakdown[0].count}` : "No stuck webhook events";
  if (s.count === 0) return "Nothing waiting";
  const money = s.values.slice(0, 2).map((v) => formatMinor(v.amountMinor, v.currency)).join(" · ");
  const age = s.oldestAt ? `oldest ${timeAgo(s.oldestAt)}` : "";
  return [money, age].filter(Boolean).join(" · ") || "Needs review";
}

function Overview() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const includeTest = params.get("includeTest") === "true";
  const { selectedCurrency } = useCurrency();
  const { data, fetchedAt, loading, error, refresh } = useActionCentre(includeTest);

  const setIncludeTest = (value: boolean) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("includeTest", "true"); else next.delete("includeTest");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const attention = useMemo(
    () => (data?.sections ?? []).filter((s) => s.state === "unavailable" || (s.state === "ok" && s.count > 0)),
    [data],
  );

  const gmvApprox = useMemo(() => {
    if (!data?.kpis || data.kpis.gmv.length === 0) return null;
    const needs = data.kpis.gmv.length > 1 || data.kpis.gmv[0].currency.toUpperCase() !== selectedCurrency;
    if (!needs) return null;
    return data.kpis.gmv.reduce((sum, g) => sum + convertMoney(g.amountMinor / 100, g.currency, selectedCurrency), 0);
  }, [data, selectedCurrency]);

  const updated = fetchedAt ? formatDateTime(new Date(fetchedAt)) : null;

  if (error?.status === 403 && !data) return <NoAccess what="the Overview" />;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        subtitle="What needs attention across Eki right now. Counts are computed on the server, not sampled."
        actions={
          <>
            <label className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={includeTest}
                onChange={(e) => setIncludeTest(e.target.checked)}
                className="h-4 w-4 accent-[#096B4A]"
              />
              Include test records
            </label>
            <div className="text-right text-xs font-semibold text-slate-500">
              {updated ? <>Last refreshed {updated}</> : "Not refreshed yet"}
              <br />Auto-refreshes every 60s
            </div>
            <Button variant="secondary" onClick={() => void refresh()} disabled={loading}>Refresh</Button>
          </>
        }
      />

      {includeTest ? (
        <Banner tone="warning" title="Test records are included">
          Figures below include QA / seed data and are not production metrics. Untick “Include test records” to exclude them.
        </Banner>
      ) : null}

      {error && !data ? <ErrorPanel message={error.message} onRetry={() => void refresh()} /> : null}
      {error && data ? (
        <Banner tone="warning" title="Could not refresh">
          Showing data from {updated}. {error.message}
        </Banner>
      ) : null}

      {!data && !error ? (
        <>
          <SkeletonRows count={4} />
          <SkeletonTiles count={8} />
        </>
      ) : null}

      {data ? (
        <>
          <section aria-labelledby="attention-h" className="space-y-3">
            <h2 id="attention-h" className="text-xl font-black text-[#101820]">What needs attention</h2>
            {attention.length === 0 ? (
              <Banner tone="success" title="All clear">Nothing is waiting in the queues you can access.</Banner>
            ) : (
              <ul className="space-y-3">
                {attention.map((s) => <AttentionRow key={s.key} section={s} onRetry={() => void refresh()} />)}
              </ul>
            )}
          </section>

          <section aria-labelledby="queues-h" className="space-y-3">
            <h2 id="queues-h" className="text-xl font-black text-[#101820]">All queues</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {data.sections.map((s) => (
                <div key={s.key} className="flex flex-col gap-1">
                  <QueueTile
                    label={s.title}
                    value={s.count}
                    hint={tileHint(s)}
                    href={s.href}
                    tone={s.state === "ok" ? (s.count > 0 ? TILE_TONE[s.severity] : "green") : "gray"}
                    unavailable={s.state === "unavailable"}
                  />
                  {s.state === "unavailable" ? (
                    <button onClick={() => void refresh()} className="self-start text-xs font-bold text-[#096B4A] underline">Retry</button>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="kpi-h" className="space-y-3">
            <h2 id="kpi-h" className="text-xl font-black text-[#101820]">Summary</h2>
            {data.kpis ? (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                  {(data.kpis.gmv.length ? data.kpis.gmv : [{ currency: "", amountMinor: 0, count: 0 }]).map((g) => (
                    <Card key={g.currency || "none"} className="!p-4">
                      <p className="text-xs font-black uppercase tracking-wide text-slate-500">GMV{g.currency ? ` (${g.currency})` : ""}</p>
                      <p className="mt-2 text-2xl font-black text-[#101820]">{g.currency ? formatMinor(g.amountMinor, g.currency) : "No paid orders"}</p>
                      {g.currency ? <p className="mt-1 text-xs font-semibold text-slate-500">{g.count} paid order{g.count === 1 ? "" : "s"}</p> : null}
                    </Card>
                  ))}
                  <Card className="!p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Orders</p>
                    <p className="mt-2 text-2xl font-black text-[#101820]">{data.kpis.totalOrders.toLocaleString()}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">excl. failed and cancelled</p>
                  </Card>
                  <Card className="!p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Active vendors</p>
                    <p className="mt-2 text-2xl font-black text-[#101820]">{data.kpis.activeVendors30d.toLocaleString()}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">paid order in last 30 days, of {data.kpis.totalVendors.toLocaleString()} vendors</p>
                  </Card>
                  <Card className="!p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Buyers</p>
                    <p className="mt-2 text-2xl font-black text-[#101820]">{data.kpis.totalBuyers.toLocaleString()}</p>
                  </Card>
                </div>
                {gmvApprox !== null ? (
                  <p className="text-sm font-semibold text-slate-600">
                    Approx. combined GMV in {selectedCurrency}: <b>{new Intl.NumberFormat(undefined, { style: "currency", currency: selectedCurrency }).format(gmvApprox)}</b>
                    {" "}— converted amounts are approximate (fixed reference rate). Original-currency figures above are authoritative.
                  </p>
                ) : null}
              </>
            ) : data.kpisError ? (
              <ErrorPanel message="Summary data unavailable." onRetry={() => void refresh()} />
            ) : (
              <p className="text-sm text-slate-500">Summary metrics are not available to your role.</p>
            )}
          </section>

          <details className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <summary className="cursor-pointer font-bold text-slate-700">About these numbers</summary>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>Failure look-back window: {data.thresholds.failureLookback}. Awaiting vendor acceptance after {data.thresholds.pendingAcceptance}; overdue delivery after {data.thresholds.undeliveredOverdue}; webhook stuck after {data.thresholds.webhookStuck}.</li>
              <li>Values are shown in each item&apos;s original currency and never added across currencies.</li>
              <li>Test records are {data.includeTest ? "included" : "excluded"}.</li>
              {data.sections.filter((s) => s.note).map((s) => <li key={s.key}><b>{s.title}:</b> {s.note}</li>)}
            </ul>
          </details>
        </>
      ) : null}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Suspense fallback={<SkeletonRows count={4} />}>
          <Overview />
        </Suspense>
      </AdminLayout>
    </ProtectedRoute>
  );
}
