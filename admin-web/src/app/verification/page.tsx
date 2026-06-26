"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Badge, Button, Card, EmptyState, ErrorPanel, Icon, LoadingPanel, PageHeader } from "@/components/AdminUI";
import { verificationAPI } from "@/lib/services/verification.api";
import { VerificationQueueItem, VerificationReviewDetails } from "@/types";
import { APIError } from "@/lib/api";

type QueueStatus = "all" | "pending" | "verified" | "rejected";

const filters: Array<{ id: QueueStatus; label: string }> = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "verified", label: "Verified" },
  { id: "rejected", label: "Rejected" },
];

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function statusTone(status: string): "green" | "amber" | "red" | "gray" {
  if (status === "VERIFIED") return "green";
  if (status === "REJECTED") return "red";
  if (status === "PENDING") return "amber";
  return "gray";
}

function docIndicators(item: VerificationQueueItem) {
  const summary = item.uploadedDocSummary;
  return [
    summary.governmentId > 0 ? "ID" : null,
    summary.selfie > 0 ? "Selfie" : null,
    summary.businessRegistration > 0 ? "Business" : null,
  ].filter(Boolean).join(" / ") || "None";
}

export default function VerificationPage() {
  const [items, setItems] = useState<VerificationQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<QueueStatus>("pending");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<VerificationReviewDetails | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await verificationAPI.getQueue({ search, status, page, limit: 20 });
      setItems(result.items);
      setTotalPages(Math.max(1, result.pagination.totalPages || 1));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load verification queue");
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetails = async (vendorId: string) => {
    try {
      setActionLoading(true);
      setSelected(await verificationAPI.getReview(vendorId));
      setRejectionReason("");
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to load review details");
    } finally {
      setActionLoading(false);
    }
  };

  const refreshSelected = async (vendorId: string) => {
    setSelected(await verificationAPI.getReview(vendorId));
    await load();
  };

  const approve = async () => {
    if (!selected) return;
    try {
      setActionLoading(true);
      setSelected(await verificationAPI.approveVendor(selected.vendor.vendorId));
      await load();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to approve vendor");
    } finally {
      setActionLoading(false);
    }
  };

  const reject = async () => {
    if (!selected) return;
    if (!rejectionReason.trim()) {
      alert("Enter a rejection reason.");
      return;
    }
    try {
      setActionLoading(true);
      setSelected(await verificationAPI.rejectVendor(selected.vendor.vendorId, rejectionReason.trim()));
      await load();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to reject vendor");
    } finally {
      setActionLoading(false);
    }
  };

  const deleteFiles = async () => {
    if (!selected) return;
    if (!confirm("Delete verification proof files now? Status and review history will be kept.")) return;
    try {
      setActionLoading(true);
      const result = await verificationAPI.deleteFilesNow(selected.vendor.vendorId);
      if (result.failedDocuments > 0) {
        alert(`Some files could not be deleted. Failed documents: ${result.failedDocuments}`);
      }
      await refreshSelected(selected.vendor.vendorId);
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to delete files");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <PageHeader
            title="Verification Review"
            subtitle="New vendors verify via Stripe Identity. Legacy document submissions shown below for review."
            actions={<Button variant="ghost" onClick={() => void load()} disabled={loading}>Refresh</Button>}
          />

          {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}

          <Card>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-xl">
                <Icon name="search" className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => { setPage(1); setSearch(event.target.value); }}
                  placeholder="Search store, vendor, email, or phone"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm font-semibold text-slate-800 outline-none focus:border-[#096B4A]"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {filters.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => { setPage(1); setStatus(filter.id); }}
                    className={`h-11 rounded-xl border px-4 text-sm font-bold transition ${
                      status === filter.id
                        ? "border-[#096B4A] bg-emerald-50 text-[#096B4A]"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {loading ? (
            <LoadingPanel label="Loading verification queue..." />
          ) : items.length === 0 ? (
            <EmptyState title="No verification submissions found" />
          ) : (
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-5 py-4 text-left text-xs font-black uppercase text-slate-500">Store</th>
                      <th className="px-5 py-4 text-left text-xs font-black uppercase text-slate-500">Vendor</th>
                      <th className="px-5 py-4 text-left text-xs font-black uppercase text-slate-500">Status</th>
                      <th className="px-5 py-4 text-left text-xs font-black uppercase text-slate-500">Submitted</th>
                      <th className="px-5 py-4 text-left text-xs font-black uppercase text-slate-500">Proofs</th>
                      <th className="px-5 py-4 text-right text-xs font-black uppercase text-slate-500">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => (
                      <tr key={item.vendorId} className="hover:bg-slate-50/70">
                        <td className="px-5 py-4">
                          <p className="font-black text-slate-900">{item.storeName}</p>
                          <p className="text-xs font-semibold text-slate-500">{item.docsAlreadyDeleted ? "Files deleted" : "Files retained"}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-800">{item.vendorName}</p>
                          <p className="text-xs text-slate-500">{item.email}{item.phone ? ` / ${item.phone}` : ""}</p>
                        </td>
                        <td className="px-5 py-4"><Badge tone={statusTone(item.verificationStatus)}>{item.verificationStatus}</Badge></td>
                        <td className="px-5 py-4 text-sm font-semibold text-slate-600">{formatDate(item.latestSubmissionDate)}</td>
                        <td className="px-5 py-4 text-sm font-bold text-slate-700">{docIndicators(item)}</td>
                        <td className="px-5 py-4 text-right">
                          <Button variant="secondary" onClick={() => void openDetails(item.vendorId)} disabled={actionLoading}>Review</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
                <p className="text-sm font-semibold text-slate-500">Page {page} of {totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button>
                  <Button variant="ghost" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
                </div>
              </div>
            </Card>
          )}

          {selected ? (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 px-4 py-8">
              <div className="mx-auto max-w-4xl rounded-2xl bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-200 p-6">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">{selected.vendor.storeName}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{selected.vendor.vendorName} / {selected.vendor.email}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600">Close</button>
                </div>

                <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px]">
                  <div className="space-y-4">
                    <div className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
                      <Info label="Status" value={<Badge tone={statusTone(selected.verificationStatus)}>{selected.verificationStatus}</Badge>} />
                      <Info label="Submitted" value={formatDate(selected.latestSubmissionDate)} />
                      <Info label="Reviewed" value={formatDate(selected.reviewedAt)} />
                      <Info label="Files" value={selected.docsAlreadyDeleted ? "Deleted" : "Available"} />
                      <Info label="Phone" value={selected.vendor.phone || "-"} />
                      <Info label="Location" value={[selected.vendor.city, selected.vendor.country].filter(Boolean).join(", ") || "-"} />
                    </div>

                    {selected.rejectionReason ? (
                      <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
                        {selected.rejectionReason}
                      </div>
                    ) : null}

                    <div className="space-y-3">
                      {selected.proofs.map((proof) => (
                        <div key={proof.id} className="rounded-xl border border-slate-200 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-black capitalize text-slate-900">{proof.type} proof</p>
                              <p className="text-xs font-semibold text-slate-500">Submitted {formatDate(proof.submittedAt)}</p>
                            </div>
                            <Badge tone={proof.deletedAt ? "gray" : statusTone(proof.status.toUpperCase())}>{proof.deletedAt ? "DELETED" : proof.status.toUpperCase()}</Badge>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {proof.frontReadUrl ? <a className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-[#096B4A]" href={proof.frontReadUrl} target="_blank" rel="noreferrer">Open front</a> : null}
                            {proof.backReadUrl ? <a className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-[#096B4A]" href={proof.backReadUrl} target="_blank" rel="noreferrer">Open back</a> : null}
                            {!proof.frontReadUrl && !proof.backReadUrl ? <span className="text-sm font-semibold text-slate-500">Proof files unavailable</span> : null}
                          </div>
                          {proof.deleteAfterAt ? <p className="mt-3 text-xs font-semibold text-slate-500">Deletes after {formatDate(proof.deleteAfterAt)}</p> : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <textarea
                      rows={5}
                      value={rejectionReason}
                      onChange={(event) => setRejectionReason(event.target.value)}
                      placeholder="Rejection reason"
                      className="w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-800 outline-none focus:border-[#096B4A]"
                    />
                    <Button className="w-full" onClick={() => void approve()} disabled={actionLoading}>Approve</Button>
                    <Button className="w-full" variant="danger" onClick={() => void reject()} disabled={actionLoading}>Reject</Button>
                    <Button className="w-full" variant="ghost" onClick={() => void deleteFiles()} disabled={actionLoading || selected.docsAlreadyDeleted}>Delete Files Now</Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-black uppercase text-slate-400">{label}</p>
      <div className="mt-1 text-sm font-bold text-slate-800">{value}</div>
    </div>
  );
}
