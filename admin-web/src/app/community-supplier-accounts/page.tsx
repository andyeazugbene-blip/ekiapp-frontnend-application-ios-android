"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { Banner, SearchInput, StatusTabs, formatDate } from "@/components/AdminKit";
import { Badge, Button, Card, ErrorPanel, Icon, PageHeader } from "@/components/AdminUI";
import { NoAccess, SkeletonRows } from "@/components/PageStates";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { formatCoverage } from "@/lib/countries";
import { communityBuyAdminAPI, type AdminSupplierAccount, type SupplierAccountList } from "@/lib/services/communityBuy.api";
import { AccountBadge, ApplicationBadge, PayoutBadge, STATE_LABELS, availableActions, useSupplierActions } from "./SupplierBits";

/**
 * Handbook 14.11 supplier review queue. Application / Account / Payout status
 * are separate columns; counts come from the server grouped by real state so
 * the tab totals always reconcile with the number of records. Pending
 * applications offer View / Request information / Approve / Reject only -
 * Suspend is a post-approval control and lives on the detail page.
 */

const TAB_STATES = ["UNDER_REVIEW", "INFORMATION_REQUIRED", "VERIFICATION_REQUIRED", "APPROVED", "PAUSED", "RESTRICTED", "SUSPENDED", "REJECTED", "CLOSED", "DRAFT", "NOT_STARTED"] as const;

function Content() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { has, loading: permLoading } = usePermissions();
  const state = params.get("status") ?? "UNDER_REVIEW";
  const q = params.get("q") ?? "";

  const [data, setData] = useState<SupplierAccountList | null>(null);
  const [rows, setRows] = useState<AdminSupplierAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  const setParam = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    setCursor(null);
    setCursorStack([]);
    router.replace(`${pathname}?${next.toString()}`);
  }, [params, pathname, router]);

  const load = useCallback(async (opts?: { bypassCache?: boolean }) => {
    try {
      setLoading(true);
      setError("");
      const result = await communityBuyAdminAPI.getSupplierAccounts(
        { state: state === "ALL" ? undefined : (state as never), q: q || undefined, cursor: cursor ?? undefined, limit: 20 },
        opts?.bypassCache ? { bypassCache: true } : undefined,
      );
      setData(result);
      setRows(result.items);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load supplier accounts");
    } finally {
      setLoading(false);
    }
  }, [state, q, cursor]);

  useEffect(() => { void load(); }, [load]);

  const actions = useSupplierActions(async (message) => { setNotice(message); await load({ bypassCache: true }); });

  if (!permLoading && !has("community_buy.read")) return <NoAccess what="supplier accounts" />;
  const canMutate = has("community_buy.mutate");
  const counts = data?.counts;
  const tabs = [
    { key: "ALL", label: "All", count: counts?.total ?? null },
    ...TAB_STATES.map((s) => ({ key: s, label: STATE_LABELS[s] ?? s, count: counts ? counts.byState[s] ?? 0 : null })),
  ];
  const countedTotal = counts ? Object.values(counts.byState).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier accounts"
        subtitle="Review supplier applications and manage approved accounts. Application, account and payout status are tracked separately."
        actions={<Button variant="ghost" onClick={() => void load({ bypassCache: true })}><Icon name="refresh" className="h-4 w-4" />Refresh</Button>}
      />
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}

      <StatusTabs tabs={tabs} active={state} onChange={(key) => setParam("status", key)} />
      {counts ? (
        <p className="text-xs font-semibold text-slate-500" aria-live="polite">
          {counts.total} supplier account{counts.total === 1 ? "" : "s"} in total{countedTotal === counts.total ? "" : " (counts differ - refresh)"}.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <SearchInput value={q} onChange={(v) => setParam("q", v)} placeholder="Search by name, email or account ID" />
      </div>

      {loading && rows.length === 0 ? <SkeletonRows count={5} /> : (
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">Supplier</th>
                <th scope="col" className="px-4 py-3">Categories and coverage</th>
                <th scope="col" className="px-4 py-3">Application</th>
                <th scope="col" className="px-4 py-3">Account</th>
                <th scope="col" className="px-4 py-3">Payouts</th>
                <th scope="col" className="px-4 py-3">Applied</th>
                <th scope="col" className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={loading ? "opacity-50" : ""}>
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center font-semibold text-slate-500">No supplier accounts match this view.</td></tr>
              ) : rows.map((a) => {
                const can = availableActions(a);
                return (
                  <tr key={a.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3">
                      <Link href={`/community-supplier-accounts/${a.id}`} className="font-bold text-[#101820] hover:underline">{a.user?.name ?? "Name not provided"}</Link>
                      <p className="text-xs text-slate-500">{a.user?.email ?? "Email not provided"}</p>
                      {a.legacySupplierProfileId ? <Badge tone="blue">Legacy-linked</Badge> : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <p>{a.categories.length > 0 ? a.categories.join(", ") : "No categories listed"}</p>
                      <p className="mt-0.5">{formatCoverage(a.coverageRegions)}</p>
                    </td>
                    <td className="px-4 py-3"><ApplicationBadge status={a.statuses?.application} /></td>
                    <td className="px-4 py-3"><AccountBadge status={a.statuses?.account} /></td>
                    <td className="px-4 py-3"><PayoutBadge status={a.statuses?.payout} /></td>
                    <td className="px-4 py-3 text-xs text-slate-600">{formatDate(a.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link href={`/community-supplier-accounts/${a.id}`} className="inline-flex h-9 items-center rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">View</Link>
                        {canMutate && can.requestInfo && a.supplierState !== "INFORMATION_REQUIRED" ? <Button variant="ghost" className="h-9 px-3" onClick={() => actions.requestInfo(a)}>Request information</Button> : null}
                        {canMutate && can.approve ? <Button className="h-9 px-3" onClick={() => actions.approve(a)}>Approve</Button> : null}
                        {canMutate && can.reject ? <Button variant="danger" className="h-9 px-3" onClick={() => actions.reject(a)}>Reject</Button> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>Showing {rows.length}</span>
        <div className="flex gap-2">
          <Button variant="ghost" className="h-9 px-3" disabled={cursorStack.length === 0 || loading} onClick={() => { const prev = [...cursorStack]; const back = prev.pop() ?? null; setCursorStack(prev); setCursor(back || null); }}>Previous</Button>
          <Button variant="ghost" className="h-9 px-3" disabled={!data?.nextCursor || loading} onClick={() => { setCursorStack((s) => [...s, cursor ?? ""]); setCursor(data?.nextCursor ?? null); }}>Next</Button>
        </div>
      </div>
      {actions.dialog}
    </div>
  );
}

export default function CommunitySupplierAccountsPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Suspense fallback={<SkeletonRows count={5} />}>
          <Content />
        </Suspense>
      </AdminLayout>
    </ProtectedRoute>
  );
}
