"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, Icon, LoadingPanel, PageHeader, downloadCsv } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { API2FARequiredError, APIError } from "@/lib/api";
import { vendorsAPI } from "@/lib/services/vendors.api";
import { Vendor, VendorStatus } from "@/types";

export default function VendorsPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<VendorStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"joined" | "store">("joined");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ vendorId: string; action: "approve" | "reject" | "suspend" | "unsuspend" } | null>(null);

  const loadVendors = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setVendors(await vendorsAPI.getVendors({ status: statusFilter === "all" ? undefined : statusFilter, search: searchQuery || undefined }));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load vendors");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    void loadVendors();
  }, [loadVendors]);

  const counts = useMemo(() => ({
    all: vendors.length,
    pending: vendors.filter((vendor) => vendor.adminStatus === "pending").length,
    active: vendors.filter((vendor) => vendor.adminStatus === "active").length,
    suspended: vendors.filter((vendor) => vendor.adminStatus === "suspended").length,
  }), [vendors]);

  const sortedVendors = useMemo(() => {
    return [...vendors].sort((a, b) => {
      if (sortBy === "store") return (a.storeName || "").localeCompare(b.storeName || "");
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
                    <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search for vendors, stores or categories..." className="w-full bg-transparent text-base outline-none" />
                  </div>
                  <Button variant="ghost" onClick={() => exportVendors(sortedVendors)}><Icon name="export" /> Export</Button>
                  <Button disabled title="Vendors must create their own seller account so store ownership, KYC, and payout data stay correct."><Icon name="plus" /> Add Vendor</Button>
                </>
              }
            />

            {error ? <ErrorPanel message={error} onRetry={() => void loadVendors()} /> : null}

            <div className="flex flex-wrap gap-4">
              {(["all", "pending", "active", "suspended"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`min-w-[130px] rounded-2xl px-8 py-5 text-center transition ${
                    statusFilter === status ? "bg-[#096B4A] text-white shadow-lg" : "bg-white text-slate-700 shadow-sm hover:bg-emerald-50"
                  }`}
                >
                  <p className="text-lg font-bold capitalize">{status}</p>
                  <p className="mt-2 text-base">{counts[status]}</p>
                </button>
              ))}
              <div className="ml-auto flex items-center gap-4">
                <Button variant="ghost" onClick={() => setSearchQuery("")}><Icon name="settings" /> Clear filters</Button>
                <Button variant="ghost" onClick={() => setSortBy((value) => value === "joined" ? "store" : "joined")}>Sort by {sortBy === "joined" ? "name" : "joined"}</Button>
              </div>
            </div>

            <Card className="overflow-hidden p-0">
              {vendors.length === 0 ? (
                <div className="p-12 text-center text-slate-500">No vendors found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-sm font-bold text-slate-600">
                        <th className="px-7 py-6">Vendor / Store</th>
                        <th className="px-7 py-6">Location</th>
                        <th className="px-7 py-6">Status</th>
                        <th className="px-7 py-6">Joined</th>
                        <th className="px-7 py-6">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedVendors.map((vendor) => (
                        <tr key={vendor.id} onMouseEnter={() => void vendorsAPI.preloadVendor(vendor.id)} className="border-b border-slate-100 last:border-0">
                          <td className="px-7 py-6">
                            <div className="flex items-center gap-5">
                              <StoreThumb vendor={vendor} />
                              <div>
                                <button onClick={() => router.push(`/vendors/${vendor.id}`)} className="text-left text-lg font-black text-[#101820] hover:text-[#096B4A]">{vendor.storeName || "Unnamed store"}</button>
                                <p className="mt-1 text-sm text-slate-500">{vendor.ownerName}</p>
                                <Badge tone="green">{vendor.subscriptionPlan || "Foodstuff"}</Badge>
                              </div>
                            </div>
                            <Link href={`/vendors/${vendor.id}`} className="mt-5 inline-flex h-11 w-full max-w-[360px] items-center justify-center rounded-xl border border-[#096B4A] text-sm font-bold text-[#096B4A]">
                              {vendor.adminStatus === "pending" ? "Review verification" : "View Details"}
                            </Link>
                          </td>
                          <td className="px-7 py-6 text-base text-slate-700"><Icon name="overview" className="mr-2 inline h-4 w-4 text-slate-500" /> {vendor.city || "Unknown"}, {vendor.country || "Unknown"}</td>
                          <td className="px-7 py-6"><StatusBadge status={vendor.adminStatus} /></td>
                          <td className="px-7 py-6 text-base text-slate-700">{vendor.joinedAt ? new Date(vendor.joinedAt).toLocaleDateString() : "N/A"}</td>
                          <td className="px-7 py-6">
                            <div className="flex flex-wrap gap-3">
                              {vendor.adminStatus === "pending" ? (
                                <>
                                  <Button variant="danger" disabled={actionLoading === vendor.id} onClick={() => void handleAction(vendor.id, "reject")}>Reject</Button>
                                  <Button disabled={actionLoading === vendor.id} onClick={() => void handleAction(vendor.id, "approve")}>Approve</Button>
                                </>
                              ) : vendor.adminStatus === "active" ? (
                                <>
                                  <Button variant="danger" disabled={actionLoading === vendor.id} onClick={() => void handleAction(vendor.id, "suspend")}>Suspend</Button>
                                  <Button onClick={() => router.push(`/vendors/${vendor.id}`)}>View activation</Button>
                                </>
                              ) : (
                                <Button variant="danger" disabled={actionLoading === vendor.id} onClick={() => void handleAction(vendor.id, "unsuspend")}>Reactivate account</Button>
                              )}
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
    status: vendor.adminStatus,
    city: vendor.city,
    country: vendor.country,
    subscriptionPlan: vendor.subscriptionPlan,
    joinedAt: vendor.joinedAt,
  })));
}

function StoreThumb({ vendor }: { vendor: Vendor }) {
  if (vendor.coverImage || vendor.avatar) {
    return <Image src={vendor.coverImage || vendor.avatar || ""} alt="" width={96} height={96} unoptimized className="h-24 w-24 rounded-2xl object-cover" />;
  }
  return <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-emerald-50 text-xl font-black text-[#096B4A]">{vendor.storeName?.slice(0, 2).toUpperCase() || "EK"}</div>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge tone="green">Active</Badge>;
  if (status === "suspended") return <Badge tone="red">Suspended</Badge>;
  return <Badge tone="amber">Pending</Badge>;
}
