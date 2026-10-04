"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import {
  Banner, DataTable, formatDateTime, Pagination, SearchInput, StatusTabs, useConfirm, type Column,
} from "@/components/AdminKit";
import { ProviderBadges, ProviderReadinessView, ProviderStageBadge } from "@/components/ProviderReadiness";
import { verificationAPI } from "@/lib/services/verification.api";
import { vendorsAPI } from "@/lib/services/vendors.api";
import { APIError } from "@/lib/api";
import type { VendorStripeStatus, VerificationQueueItem, VerificationReviewDetails } from "@/types";

type QueueStatus = "all" | "pending" | "verified" | "rejected";

const tabs: Array<{ key: QueueStatus; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "verified", label: "Verified" },
  { key: "rejected", label: "Needs retry / rejected" },
  { key: "all", label: "All" },
];

function methodLabel(method: string): string {
  if (method === "STRIPE_IDENTITY") return "Stripe Identity";
  if (method === "BOTH") return "Stripe + legacy documents";
  return "Legacy documents";
}

function docIndicators(item: VerificationQueueItem) {
  const s = item.uploadedDocSummary;
  return [s.governmentId > 0 ? "ID" : null, s.selfie > 0 ? "Selfie" : null, s.businessRegistration > 0 ? "Business" : null]
    .filter(Boolean).join(" / ") || "None";
}

function VerificationInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const status = (params.get("status") as QueueStatus) || "pending";
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);

  const setParams = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") next.delete(k); else next.set(k, v);
    }
    router.replace(`${pathname}?${next.toString()}`);
  }, [params, pathname, router]);

  const [items, setItems] = useState<VerificationQueueItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastLoaded, setLastLoaded] = useState<Date | null>(null);

  const [selected, setSelected] = useState<VerificationReviewDetails | null>(null);
  const [stripe, setStripe] = useState<VendorStripeStatus | null>(null);
  const [drawerBusy, setDrawerBusy] = useState(false);
  const [drawerError, setDrawerError] = useState("");
  const [notice, setNotice] = useState("");
  const confirm = useConfirm();

  const load = useCallback(async () => {
    try {
      setLoading(true); setError("");
      const result = await verificationAPI.getQueue({ search: q, status, page, limit: 20 });
      setItems(result.items);
      setTotal(result.pagination.total);
      setTotalPages(Math.max(1, result.pagination.totalPages || 1));
      setLastLoaded(new Date());
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load verification queue");
    } finally { setLoading(false); }
  }, [q, status, page]);

  useEffect(() => { void load(); }, [load]);

  const openDetails = async (vendorId: string) => {
    try {
      setDrawerBusy(true); setDrawerError(""); setNotice("");
      const [details, stripeStatus] = await Promise.all([
        verificationAPI.getReview(vendorId),
        vendorsAPI.getStripeStatus(vendorId).catch(() => null),
      ]);
      setSelected(details);
      setStripe(stripeStatus);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load review details");
    } finally { setDrawerBusy(false); }
  };

  const refreshStripe = async () => {
    if (!selected) return;
    try {
      setDrawerBusy(true); setDrawerError("");
      setStripe(await vendorsAPI.getStripeStatus(selected.vendor.vendorId, true));
      await load();
    } catch (err) {
      setDrawerError(err instanceof APIError ? err.message : "Could not refresh from Stripe");
    } finally { setDrawerBusy(false); }
  };

  const remind = async () => {
    if (!selected) return;
    try {
      setDrawerBusy(true); setDrawerError(""); setNotice("");
      await vendorsAPI.sendStripeReminder(selected.vendor.vendorId);
      setNotice("Reminder sent to the vendor.");
      setStripe(await vendorsAPI.getStripeStatus(selected.vendor.vendorId));
    } catch (err) {
      setDrawerError(err instanceof APIError ? err.message : "Could not send reminder");
    } finally { setDrawerBusy(false); }
  };

  const legacyApprove = () => {
    if (!selected) return;
    confirm.ask(
      {
        title: "Approve legacy verification",
        tone: "primary",
        confirmLabel: "Approve",
        description: "Legacy document review only. The vendor has no Stripe record, so Eki staff are the reviewer of record. This is audited.",
        reasonLabel: "Reason / what you checked",
      },
      async () => {
        setSelected(await verificationAPI.approveVendor(selected.vendor.vendorId));
        await load();
      },
    );
  };

  const legacyReject = () => {
    if (!selected) return;
    confirm.ask(
      {
        title: "Reject legacy verification",
        confirmLabel: "Reject",
        description: "The reason is sent to the vendor.",
        reasonLabel: "Rejection reason (shown to the vendor)",
      },
      async (reason) => {
        setSelected(await verificationAPI.rejectVendor(selected.vendor.vendorId, reason));
        await load();
      },
    );
  };

  const deleteFiles = () => {
    if (!selected) return;
    confirm.ask(
      {
        title: "Delete verification proof files now?",
        confirmLabel: "Delete files",
        description: "Status and review history are kept; the uploaded files are removed permanently.",
        requireReason: false,
      },
      async () => {
        const result = await verificationAPI.deleteFilesNow(selected.vendor.vendorId);
        if (result.failedDocuments > 0) throw new Error(`Some files could not be deleted (${result.failedDocuments}).`);
        setSelected(await verificationAPI.getReview(selected.vendor.vendorId));
        await load();
      },
    );
  };

  const columns: Column<VerificationQueueItem>[] = [
    {
      key: "store", header: "Vendor",
      render: (r) => (
        <div>
          <p className="font-black text-slate-900">{r.storeName}</p>
          <p className="text-xs font-semibold text-slate-500">{r.vendorName || "Name not provided"} · {r.email || "No email"}</p>
        </div>
      ),
    },
    {
      key: "provider", header: "Stripe state",
      render: (r) => (
        <div className="space-y-1.5">
          <ProviderStageBadge provider={r.provider} />
          <ProviderBadges provider={r.provider} />
        </div>
      ),
    },
    { key: "method", header: "Method", render: (r) => <Badge tone={r.verificationMethod === "MANUAL_DOCUMENTS" ? "gray" : "blue"}>{methodLabel(r.verificationMethod)}</Badge> },
    {
      key: "update", header: "Last update",
      render: (r) => <span className="text-xs font-semibold text-slate-600">{formatDateTime(r.provider?.connect.fetchedAt ?? r.provider?.identity.updatedAt ?? r.latestSubmissionDate)}</span>,
    },
    {
      key: "action", header: "", className: "text-right",
      render: (r) => <Button variant="secondary" className="h-9 px-4" onClick={(e) => { e.stopPropagation(); void openDetails(r.vendorId); }} disabled={drawerBusy}>Review</Button>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Verification"
        subtitle="Stripe is the source of truth. Identity, card payments and payouts are separate states and update automatically from Stripe."
        actions={
          <>
            {lastLoaded ? <span className="text-xs font-semibold text-slate-500">Updated {formatDateTime(lastLoaded)}</span> : null}
            <Button variant="ghost" onClick={() => void load()} disabled={loading}>Refresh</Button>
          </>
        }
      />

      <Banner tone="info" title="No manual approval for Stripe-managed vendors">
        Approve and Reject are intentionally unavailable for vendors verified through Stripe. Use <strong>Review</strong> to see the provider state, requirements due, and to send the vendor a secure reminder.
      </Banner>

      {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}

      <Card className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SearchInput value={q} onChange={(v) => setParams({ q: v, page: null })} placeholder="Search store, vendor, email or phone" />
          <StatusTabs tabs={tabs} active={status} onChange={(k) => setParams({ status: k, page: null })} />
        </div>
        {loading && items.length === 0 ? (
          <LoadingPanel label="Loading verification queue…" />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={items}
              rowKey={(r) => r.vendorId}
              onRowClick={(r) => void openDetails(r.vendorId)}
              loading={loading}
              emptyTitle="No vendors match this view"
            />
            <Pagination
              hasPrev={page > 1} hasNext={page < totalPages}
              onPrev={() => setParams({ page: String(page - 1) })} onNext={() => setParams({ page: String(page + 1) })}
              shown={items.length} total={total} loading={loading}
            />
          </>
        )}
      </Card>

      {selected ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/45 px-4 py-8" role="dialog" aria-modal="true" aria-label="Verification review">
          <div className="mx-auto max-w-4xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 p-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900">{selected.vendor.storeName}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {selected.vendor.vendorName || "Name not provided"} · {selected.vendor.email || "No email"}
                  {selected.vendor.phone ? ` · ${selected.vendor.phone}` : ""}
                  {[selected.vendor.city, selected.vendor.country].filter(Boolean).length ? ` · ${[selected.vendor.city, selected.vendor.country].filter(Boolean).join(", ")}` : ""}
                </p>
              </div>
              <Button variant="ghost" className="h-9 px-3" onClick={() => { setSelected(null); setStripe(null); }}>Close</Button>
            </div>

            <div className="space-y-6 p-6">
              {drawerError ? <ErrorPanel message={drawerError} /> : null}
              {notice ? <Banner tone="success">{notice}</Banner> : null}

              <section>
                <h3 className="mb-3 text-lg font-black text-[#101820]">Stripe provider state</h3>
                {stripe ? (
                  <ProviderReadinessView data={stripe} busy={drawerBusy} onRefresh={() => void refreshStripe()} onRemind={() => void remind()} />
                ) : (
                  <Banner tone="warning">Live Stripe status could not be loaded. Showing the last stored state from the queue.</Banner>
                )}
              </section>

              {selected.proofs.length > 0 || selected.verificationMethod !== "STRIPE_IDENTITY" ? (
                <section>
                  <h3 className="mb-1 text-lg font-black text-[#101820]">Legacy document review <Badge tone="gray">Read-only for Stripe vendors</Badge></h3>
                  <p className="mb-3 text-xs font-semibold text-slate-500">
                    Pre-Stripe records. {selected.manualReviewAllowed ? "This vendor has no Stripe record, so manual review is still possible." : "Manual decisions are disabled because Stripe controls this vendor's verification."}
                  </p>
                  {selected.rejectionReason ? <Banner tone="danger">{selected.rejectionReason}</Banner> : null}
                  {selected.proofs.length === 0 ? (
                    <p className="text-sm font-semibold text-slate-500">No documents on file.</p>
                  ) : (
                    <div className="space-y-3">
                      {selected.proofs.map((proof) => (
                        <div key={proof.id} className="rounded-xl border border-slate-200 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-black capitalize text-slate-900">{proof.type} proof</p>
                              <p className="text-xs font-semibold text-slate-500">Submitted {formatDateTime(proof.submittedAt)}</p>
                            </div>
                            <Badge tone={proof.deletedAt ? "gray" : proof.status === "approved" ? "green" : proof.status === "rejected" ? "red" : "amber"}>
                              {proof.deletedAt ? "DELETED" : proof.status.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {proof.frontReadUrl ? <a className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-[#096B4A]" href={proof.frontReadUrl} target="_blank" rel="noreferrer">Open front</a> : null}
                            {proof.backReadUrl ? <a className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-[#096B4A]" href={proof.backReadUrl} target="_blank" rel="noreferrer">Open back</a> : null}
                            {!proof.frontReadUrl && !proof.backReadUrl ? <span className="text-sm font-semibold text-slate-500">Files unavailable</span> : null}
                          </div>
                          {proof.deleteAfterAt ? <p className="mt-2 text-xs font-semibold text-slate-500">Deletes after {formatDateTime(proof.deleteAfterAt)}</p> : null}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-3">
                    {selected.manualReviewAllowed ? (
                      <>
                        <Button onClick={legacyApprove} disabled={drawerBusy}>Approve (legacy)</Button>
                        <Button variant="danger" onClick={legacyReject} disabled={drawerBusy}>Reject (legacy)</Button>
                      </>
                    ) : null}
                    <Button variant="ghost" onClick={deleteFiles} disabled={drawerBusy || selected.docsAlreadyDeleted}>Delete proof files now</Button>
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {confirm.dialog}
    </div>
  );
}

export default function VerificationPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Suspense fallback={<LoadingPanel label="Loading verification…" />}>
          <VerificationInner />
        </Suspense>
      </AdminLayout>
    </ProtectedRoute>
  );
}
