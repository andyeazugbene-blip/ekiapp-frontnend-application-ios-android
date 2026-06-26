"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, Icon, LoadingPanel, PageHeader, downloadCsv } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { API2FARequiredError, APIError } from "@/lib/api";
import { vendorsAPI, VendorStats } from "@/lib/services/vendors.api";
import { Vendor, VendorStatus } from "@/types";

function fmtMoney(cents: number): string {
  return (cents / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtRevenue(amount: number): string {
  return amount.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function VendorsPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [stats, setStats] = useState<VendorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<VendorStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"joined" | "store" | "revenue" | "orders">("joined");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ vendorId: string; action: "approve" | "reject" | "suspend" | "unsuspend" } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const loadVendors = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [vendorList, vendorStats] = await Promise.all([
        vendorsAPI.getVendors({ status: statusFilter === "all" ? undefined : statusFilter, search: searchQuery || undefined }),
        vendorsAPI.getVendorStats(),
      ]);
      setVendors(vendorList);
      setStats(vendorStats);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load vendors");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    void loadVendors();
  }, [loadVendors]);

  const sortedVendors = useMemo(() => {
    return [...vendors].sort((a, b) => {
      if (sortBy === "store") return (a.storeName || "").localeCompare(b.storeName || "");
      if (sortBy === "revenue") return (b.totalRevenue ?? 0) - (a.totalRevenue ?? 0);
      if (sortBy === "orders") return (b.totalOrders ?? 0) - (a.totalOrders ?? 0);
      return new Date(b.joinedAt || 0).getTime() - new Date(a.joinedAt || 0).getTime();
    });
  }, [sortBy, vendors]);

  const performAction = async (vendorId: string, action: "approve" | "reject" | "suspend" | "unsuspend", code?: string) => {
    if (action === "approve") await vendorsAPI.approveVendor(vendorId);
    if (action === "reject") await vendorsAPI.rejectVendor(vendorId);
    if (action === "suspend") await vendorsAPI.suspendVendor(vendorId, code);
    if (action === "unsuspend") await vendorsAPI.unsuspendVendor(vendorId, code);
  };

  const handleAction = async (vendorId: string, action: "approve" | "reject" | "suspend" | "unsuspend") => {
    if (!confirm(`Are you sure you want to ${action} this vendor?`)) return;
    try {
      setActionLoading(vendorId);
      await performAction(vendorId, action);
      await loadVendors();
    } catch (err) {
      if (err instanceof API2FARequiredError) {
        setPendingAction({ vendorId, action });
        setShow2FAModal(true);
      } else {
        alert(err instanceof APIError ? err.message : `Failed to ${action} vendor`);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handle2FASubmit = async () => {
    if (!pendingAction || !twoFactorCode) return;
    try {
      setActionLoading(pendingAction.vendorId);
      await performAction(pendingAction.vendorId, pendingAction.action, twoFactorCode);
      await loadVendors();
      setShow2FAModal(false);
      setTwoFactorCode("");
      setPendingAction(null);
    } catch (err) {
      alert(err instanceof APIError ? err.message : "2FA action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedVendors.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedVendors.map((v) => v.id)));
    }
  };

  const handleBulkAction = async (action: "approve" | "reject" | "suspend") => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${ids.length} vendor(s)?`)) return;
    try {
      setBulkLoading(true);
      if (action === "approve") await vendorsAPI.bulkApprove(ids);
      if (action === "reject") await vendorsAPI.bulkReject(ids);
      if (action === "suspend") await vendorsAPI.bulkSuspend(ids);
      setSelectedIds(new Set());
      await loadVendors();
    } catch (err) {
      alert(err instanceof APIError ? err.message : `Bulk ${action} failed`);
    } finally {
      setBulkLoading(false);
    }
  };

  const statCards: { label: string; value: number | string; color?: string }[] = stats ? [
    { label: "Total Vendors", value: stats.total },
    { label: "Active", value: stats.active, color: "text-emerald-600" },
    { label: "Pending", value: stats.pending, color: "text-amber-600" },
    { label: "Rejected", value: stats.rejected, color: "text-red-600" },
    { label: "Suspended", value: stats.suspended, color: "text-red-500" },
    { label: "Verified", value: stats.verified, color: "text-emerald-600" },
    { label: "Unverified", value: stats.unverified },
    { label: "With Orders", value: stats.withOrders },
    { label: "No Orders", value: stats.withoutOrders },
    { label: "Avg Revenue", value: fmtMoney(stats.avgRevenue) },
    { label: "Total GMV", value: fmtMoney(stats.gmv) },
  ] : [];

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? (
          <LoadingPanel label="Loading vendors..." />
        ) : (
          <div className="space-y-8">
            <PageHeader
              title="Vendor Management"
              subtitle="Manage and monitor all vendors on the platform."
              actions={
                <>
                  <div className="flex h-14 min-w-[420px] items-center gap-3 rounded-xl border border-slate-300 bg-white px-5">
                    <Icon name="search" className="h-5 w-5 text-slate-400" />
                    <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search vendors, stores..." className="w-full bg-transparent text-base outline-none" />
                  </div>
                  <Button variant="ghost" onClick={() => exportVendors(sortedVendors)}><Icon name="export" /> Export</Button>
                </>
              }
            />

            {error ? <ErrorPanel message={error} onRetry={() => void loadVendors()} /> : null}

            {/* Summary stats grid */}
            {stats && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11">
                {statCards.map((card) => (
                  <div key={card.label} className="rounded-xl bg-white p-4 shadow-sm">
                    <p className="text-xs font-medium text-slate-500">{card.label}</p>
                    <p className={`mt-1 text-xl font-black ${card.color ?? "text-slate-900"}`}>{card.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Filter + sort bar */}
            <div className="flex flex-wrap items-center gap-3">
              {(["all", "pending", "active", "suspended"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-xl px-5 py-2.5 text-sm font-bold capitalize transition ${
                    statusFilter === status ? "bg-[#096B4A] text-white shadow" : "bg-white text-slate-700 shadow-sm hover:bg-emerald-50"
                  }`}
                >
                  {status}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-3">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="joined">Sort: Joined</option>
                  <option value="store">Sort: Store name</option>
                  <option value="revenue">Sort: Revenue</option>
                  <option value="orders">Sort: Orders</option>
                </select>
              </div>
            </div>

            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-5 py-3">
                <span className="text-sm font-bold text-emerald-800">{selectedIds.size} selected</span>
                <Button disabled={bulkLoading} onClick={() => void handleBulkAction("approve")}>Bulk Approve</Button>
                <Button variant="danger" disabled={bulkLoading} onClick={() => void handleBulkAction("reject")}>Bulk Reject</Button>
                <Button variant="danger" disabled={bulkLoading} onClick={() => void handleBulkAction("suspend")}>Bulk Suspend</Button>
                <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-sm text-slate-600 hover:text-slate-900">Clear</button>
              </div>
            )}

            {/* Vendors table */}
            <Card className="overflow-hidden p-0">
              {vendors.length === 0 ? (
                <div className="p-12 text-center text-slate-500">No vendors found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-4">
                          <input type="checkbox" checked={selectedIds.size === sortedVendors.length && sortedVendors.length > 0} onChange={toggleSelectAll} className="h-4 w-4 rounded" />
                        </th>
                        <th className="px-4 py-4">Vendor / Store</th>
                        <th className="px-4 py-4">Email</th>
                        <th className="px-4 py-4">Location</th>
                        <th className="px-4 py-4">Verification</th>
                        <th className="px-4 py-4">Status</th>
                        <th className="px-4 py-4">Plan</th>
                        <th className="px-4 py-4 text-right">Orders</th>
                        <th className="px-4 py-4 text-right">Revenue</th>
                        <th className="px-4 py-4">Joined</th>
                        <th className="px-4 py-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedVendors.map((vendor) => (
                        <tr key={vendor.id} className={`border-b border-slate-100 last:border-0 ${selectedIds.has(vendor.id) ? "bg-emerald-50/50" : ""}`}>
                          <td className="px-4 py-4">
                            <input type="checkbox" checked={selectedIds.has(vendor.id)} onChange={() => toggleSelect(vendor.id)} className="h-4 w-4 rounded" />
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <StoreThumb vendor={vendor} />
                              <div className="min-w-0">
                                <button onClick={() => router.push(`/vendors/${vendor.id}`)} className="truncate text-sm font-black text-[#101820] hover:text-[#096B4A]">{vendor.storeName || "Unnamed"}</button>
                                <p className="truncate text-xs text-slate-500">{vendor.ownerName}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-600">{vendor.email || "—"}</td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">{vendor.city || "?"}, {vendor.country || "?"}</td>
                          <td className="px-4 py-4"><VerificationBadge status={vendor.verificationStatus} /></td>
                          <td className="px-4 py-4"><StatusBadge status={vendor.adminStatus} /></td>
                          <td className="px-4 py-4">
                            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 capitalize">{vendor.subscriptionPlan}</span>
                          </td>
                          <td className="px-4 py-4 text-right text-sm font-semibold text-slate-900">{vendor.totalOrders}</td>
                          <td className="px-4 py-4 text-right text-sm font-semibold text-slate-900">{fmtRevenue(vendor.totalRevenue ?? 0)}</td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">{vendor.joinedAt ? new Date(vendor.joinedAt).toLocaleDateString() : "—"}</td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-2">
                              {vendor.adminStatus === "pending" ? (
                                <>
                                  <Button variant="danger" disabled={actionLoading === vendor.id} onClick={() => void handleAction(vendor.id, "reject")}>Reject</Button>
                                  <Button disabled={actionLoading === vendor.id} onClick={() => void handleAction(vendor.id, "approve")}>Approve</Button>
                                </>
                              ) : vendor.adminStatus === "active" ? (
                                <Button variant="danger" disabled={actionLoading === vendor.id} onClick={() => void handleAction(vendor.id, "suspend")}>Suspend</Button>
                              ) : (
                                <Button disabled={actionLoading === vendor.id} onClick={() => void handleAction(vendor.id, "unsuspend")}>Reactivate</Button>
                              )}
                              <Link href={`/vendors/${vendor.id}`} className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">View</Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <p className="text-sm text-slate-500">Showing {sortedVendors.length} vendors</p>
          </div>
        )}

        {show2FAModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
            <Card className="w-full max-w-md">
              <h3 className="text-2xl font-black">2FA Required</h3>
              <input value={twoFactorCode} onChange={(event) => setTwoFactorCode(event.target.value)} placeholder="000000" className="mt-6 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]" />
              <div className="mt-6 flex gap-3">
                <Button className="flex-1" onClick={() => void handle2FASubmit()}>Submit</Button>
                <Button className="flex-1" variant="ghost" onClick={() => setShow2FAModal(false)}>Cancel</Button>
              </div>
            </Card>
          </div>
        ) : null}
      </AdminLayout>
    </ProtectedRoute>
  );
}

function exportVendors(vendors: Vendor[]) {
  downloadCsv("eki-vendors.csv", vendors.map((vendor) => ({
    id: vendor.id,
    storeName: vendor.storeName,
    ownerName: vendor.ownerName,
    email: vendor.email,
    phone: vendor.phone,
    status: vendor.adminStatus,
    verificationStatus: vendor.verificationStatus,
    city: vendor.city,
    country: vendor.country,
    subscriptionPlan: vendor.subscriptionPlan,
    totalOrders: vendor.totalOrders,
    totalRevenue: vendor.totalRevenue,
    joinedAt: vendor.joinedAt,
  })));
}

function StoreThumb({ vendor }: { vendor: Vendor }) {
  if (vendor.coverImage || vendor.avatar) {
    return <Image src={vendor.coverImage || vendor.avatar || ""} alt="" width={48} height={48} unoptimized className="h-12 w-12 rounded-xl object-cover" />;
  }
  return <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-sm font-black text-[#096B4A]">{vendor.storeName?.slice(0, 2).toUpperCase() || "EK"}</div>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge tone="green">Active</Badge>;
  if (status === "suspended") return <Badge tone="red">Suspended</Badge>;
  return <Badge tone="amber">Pending</Badge>;
}

function VerificationBadge({ status }: { status: string }) {
  if (status === "verified") return <Badge tone="green">Verified</Badge>;
  if (status === "rejected") return <Badge tone="red">Rejected</Badge>;
  return <Badge tone="amber">Pending</Badge>;
}
