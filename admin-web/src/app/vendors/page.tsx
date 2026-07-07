"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, Icon, LoadingPanel, downloadCsv } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { API2FARequiredError, APIError } from "@/lib/api";
import { vendorsAPI, VendorStats } from "@/lib/services/vendors.api";
import { Vendor, VendorStatus } from "@/types";

type TabKey = "all" | "pending" | "approved" | "rejected" | "suspended" | "verified" | "active" | "trial" | "highRevenue";

function fmtMoney(amount: number): string {
  return `GBP ${amount.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function StatCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3.5">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`mt-1 text-2xl font-black ${color ?? "text-[#101820]"}`}>{value}</p>
    </div>
  );
}

export default function VendorsPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [stats, setStats] = useState<VendorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [subscriptionFilter, setSubscriptionFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ vendorId: string; action: "approve" | "reject" | "suspend" | "unsuspend" } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState("");
  const perPage = 8;

  const loadVendors = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [vendorList, vendorStats] = await Promise.all([
        vendorsAPI.getVendors(),
        vendorsAPI.getVendorStats(),
      ]);
      setVendors(vendorList);
      setStats(vendorStats);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load vendors");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadVendors(); }, [loadVendors]);

  const filteredVendors = useMemo(() => {
    let list = [...vendors];
    if (activeTab === "pending") list = list.filter(v => v.adminStatus === "pending");
    else if (activeTab === "approved") list = list.filter(v => v.adminStatus === "active");
    else if (activeTab === "rejected") list = list.filter(v => v.verificationStatus === "rejected");
    else if (activeTab === "suspended") list = list.filter(v => v.adminStatus === "suspended");
    else if (activeTab === "verified") list = list.filter(v => v.verificationStatus === "verified");
    else if (activeTab === "active") list = list.filter(v => v.adminStatus === "active");
    else if (activeTab === "trial") list = list.filter(v => v.subscriptionPlan === "free" || v.subscriptionStatus === "trial");
    else if (activeTab === "highRevenue") list = list.sort((a, b) => (b.totalRevenue ?? 0) - (a.totalRevenue ?? 0));

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(v => v.storeName.toLowerCase().includes(q) || v.ownerName.toLowerCase().includes(q) || (v.email ?? "").toLowerCase().includes(q) || (v.phone ?? "").includes(q));
    }
    if (countryFilter !== "all") list = list.filter(v => v.country === countryFilter);
    if (statusFilter !== "all") list = list.filter(v => v.adminStatus === statusFilter);
    if (verificationFilter !== "all") list = list.filter(v => v.verificationStatus === verificationFilter);
    if (subscriptionFilter !== "all") list = list.filter(v => v.subscriptionPlan === subscriptionFilter || v.subscriptionStatus === subscriptionFilter);
    return list;
  }, [vendors, activeTab, searchQuery, countryFilter, statusFilter, verificationFilter, subscriptionFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredVendors.length / perPage));
  const pagedVendors = filteredVendors.slice((page - 1) * perPage, page * perPage);

  const countries = useMemo(() => [...new Set(vendors.map(v => v.country).filter(Boolean))].sort(), [vendors]);

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
      if (err instanceof API2FARequiredError) { setPendingAction({ vendorId, action }); setShow2FAModal(true); }
      else alert(err instanceof APIError ? err.message : `Failed to ${action} vendor`);
    } finally { setActionLoading(null); }
  };

  const handle2FASubmit = async () => {
    if (!pendingAction || !twoFactorCode) return;
    try {
      setActionLoading(pendingAction.vendorId);
      await performAction(pendingAction.vendorId, pendingAction.action, twoFactorCode);
      await loadVendors();
      setShow2FAModal(false); setTwoFactorCode(""); setPendingAction(null);
    } catch (err) { alert(err instanceof APIError ? err.message : "2FA action failed"); }
    finally { setActionLoading(null); }
  };

  const toggleSelect = (id: string) => setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleSelectAll = () => setSelectedIds(selectedIds.size === pagedVendors.length ? new Set() : new Set(pagedVendors.map(v => v.id)));

  const handleBulkAction = async (action: "approve" | "reject" | "suspend") => {
    const ids = [...selectedIds];
    if (!ids.length || !confirm(`${action} ${ids.length} vendor(s)?`)) return;
    try {
      setBulkLoading(true);
      if (action === "approve") await vendorsAPI.bulkApprove(ids);
      if (action === "reject") await vendorsAPI.bulkReject(ids);
      if (action === "suspend") await vendorsAPI.bulkSuspend(ids);
      setSelectedIds(new Set());
      await loadVendors();
    } catch (err) { alert(err instanceof APIError ? err.message : `Bulk ${action} failed`); }
    finally { setBulkLoading(false); }
  };

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "all", label: "All Vendors" },
    { key: "pending", label: `Pending (${stats?.pending ?? 0})` },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
    { key: "suspended", label: "Suspended" },
    { key: "verified", label: "Verified" },
    { key: "active", label: "Active" },
    { key: "trial", label: "Trial" },
    { key: "highRevenue", label: "High Revenue" },
  ];

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? <LoadingPanel label="Loading vendors..." /> : (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-[#101820]">Vendor Management</h1>
                <p className="text-[13px] text-slate-400">{stats?.total ?? 0} vendors total · {stats?.pending ?? 0} pending approval</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 gap-2">
                  <Icon name="search" className="h-4 w-4 text-slate-400" />
                  <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }} placeholder="Search vendors..." className="w-48 bg-transparent text-[13px] outline-none" />
                </div>
                <Button onClick={() => setShowInvite(true)}><Icon name="plus" className="h-4 w-4" /> Invite Vendor</Button>
                <Button variant="ghost" onClick={() => downloadCsv("eki-vendors.csv", filteredVendors.map(v => ({ id: v.id, storeName: v.storeName, ownerName: v.ownerName, email: v.email, country: v.country, status: v.adminStatus, verification: v.verificationStatus, plan: v.subscriptionPlan, orders: v.totalOrders, revenue: v.totalRevenue, joined: v.joinedAt })))}>Export CSV</Button>
              </div>
            </div>

            {error && <ErrorPanel message={error} onRetry={() => void loadVendors()} />}

            {/* Stat Cards */}
            {stats && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 xl:grid-cols-10">
                <StatCard label="Total" value={stats.total} />
                <StatCard label="Active" value={stats.active} color="text-emerald-600" />
                <StatCard label="Pending" value={stats.pending} color="text-amber-500" />
                <StatCard label="Approved" value={stats.active + stats.verified} color="text-emerald-600" />
                <StatCard label="Rejected" value={stats.rejected} color="text-red-500" />
                <StatCard label="Suspended" value={stats.suspended} color="text-red-500" />
                <StatCard label="Verified" value={stats.verified} color="text-emerald-600" />
                <StatCard label="Unverified" value={stats.unverified} color="text-amber-500" />
                <StatCard label="With Orders" value={stats.withOrders} />
                <StatCard label="No Orders" value={stats.withoutOrders} color="text-amber-500" />
              </div>
            )}

            {/* Tabs */}
            <div className="flex items-center gap-6 border-b border-slate-100">
              {tabs.map(tab => (
                <button key={tab.key} onClick={() => { setActiveTab(tab.key); setPage(1); }} className={`relative pb-3 text-[13px] font-semibold transition ${activeTab === tab.key ? "text-[#096B4A]" : "text-slate-400 hover:text-slate-600"}`}>
                  {tab.label}
                  {activeTab === tab.key && <span className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-[#096B4A]" />}
                </button>
              ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }} placeholder="Search name, email, phone..." className="h-9 w-48 rounded-xl border border-slate-200 bg-white px-3 text-[12px] outline-none" />
              <select value={countryFilter} onChange={e => { setCountryFilter(e.target.value); setPage(1); }} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-[12px] text-slate-600">
                <option value="all">Country: All</option>
                {countries.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-[12px] text-slate-600">
                <option value="all">Status: All</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </select>
              <select value={verificationFilter} onChange={e => { setVerificationFilter(e.target.value); setPage(1); }} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-[12px] text-slate-600">
                <option value="all">Verification: All</option>
                <option value="verified">Verified</option>
                <option value="pending_docs">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
              <select value={subscriptionFilter} onChange={e => { setSubscriptionFilter(e.target.value); setPage(1); }} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-[12px] text-slate-600">
                <option value="all">Subscription: All</option>
                <option value="free">Free</option>
                <option value="growth">Growth</option>
                <option value="pro">Pro</option>
              </select>
              {selectedIds.size > 0 && (
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[12px] font-bold text-slate-600">{selectedIds.size} selected</span>
                  <select onChange={e => { if (e.target.value) void handleBulkAction(e.target.value as any); e.target.value = ""; }} disabled={bulkLoading} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-[12px] font-semibold text-slate-600">
                    <option value="">Bulk Actions</option>
                    <option value="approve">Approve</option>
                    <option value="reject">Reject</option>
                    <option value="suspend">Suspend</option>
                  </select>
                </div>
              )}
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
              {pagedVendors.length === 0 ? (
                <div className="p-12 text-center text-sm text-slate-400">No vendors found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        <th className="px-4 py-3.5 w-10"><input type="checkbox" checked={selectedIds.size === pagedVendors.length && pagedVendors.length > 0} onChange={toggleSelectAll} className="h-4 w-4 rounded" /></th>
                        <th className="px-4 py-3.5">Vendor</th>
                        <th className="px-4 py-3.5">Email</th>
                        <th className="px-4 py-3.5">Country</th>
                        <th className="px-4 py-3.5">Joined</th>
                        <th className="px-4 py-3.5">Verification</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5">Subscription</th>
                        <th className="px-4 py-3.5">GMV</th>
                        <th className="px-4 py-3.5 text-right">Orders</th>
                        <th className="px-4 py-3.5">Last Active</th>
                        <th className="px-4 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedVendors.map(vendor => (
                        <tr key={vendor.id} className={`border-b border-slate-50 hover:bg-slate-50/50 ${selectedIds.has(vendor.id) ? "bg-emerald-50/30" : ""}`}>
                          <td className="px-4 py-3.5"><input type="checkbox" checked={selectedIds.has(vendor.id)} onChange={() => toggleSelect(vendor.id)} className="h-4 w-4 rounded" /></td>
                          <td className="px-4 py-3.5">
                            <Link href={`/vendors/${vendor.id}`} className="flex items-center gap-3 group">
                              <VendorAvatar vendor={vendor} />
                              <div className="min-w-0">
                                <p className="text-[13px] font-bold text-[#101820] group-hover:text-[#096B4A] truncate">{vendor.storeName || "Unnamed"}</p>
                                <p className="text-[11px] text-slate-400 truncate">{vendor.ownerName}</p>
                              </div>
                            </Link>
                          </td>
                          <td className="px-4 py-3.5 text-[12px] text-slate-600">{vendor.email || "—"}</td>
                          <td className="px-4 py-3.5 text-[12px] text-slate-600">{vendor.country || "—"}</td>
                          <td className="px-4 py-3.5 text-[12px] text-slate-500">{vendor.joinedAt ? new Date(vendor.joinedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }) : "—"}</td>
                          <td className="px-4 py-3.5"><VerifBadge status={vendor.verificationStatus} /></td>
                          <td className="px-4 py-3.5"><StatusBdg status={vendor.adminStatus} /></td>
                          <td className="px-4 py-3.5"><SubBadge plan={vendor.subscriptionPlan} status={vendor.subscriptionStatus} /></td>
                          <td className="px-4 py-3.5 text-[12px] font-semibold text-slate-800">{fmtMoney(vendor.totalRevenue ?? 0)}</td>
                          <td className="px-4 py-3.5 text-right text-[12px] font-semibold text-slate-800">{vendor.totalOrders}</td>
                          <td className="px-4 py-3.5 text-[11px] text-slate-400">{timeAgo(vendor.joinedAt)}</td>
                          <td className="px-4 py-3.5 text-right">
                            <button
                              disabled={actionLoading === vendor.id}
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm(`Permanently delete vendor "${vendor.storeName}"? This cannot be undone.`)) return;
                                try {
                                  setActionLoading(vendor.id);
                                  const result = await vendorsAPI.deleteVendor(vendor.id);
                                  alert(result.message);
                                  await loadVendors();
                                } catch (err) {
                                  alert(err instanceof APIError ? err.message : "Delete failed");
                                } finally { setActionLoading(null); }
                              }}
                              className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-red-500 hover:bg-red-50 disabled:opacity-40"
                            >
                              {actionLoading === vendor.id ? "..." : "Delete"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-slate-400">Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, filteredVendors.length)} of {filteredVendors.length} vendors</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40">Prev</button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <button key={p} onClick={() => setPage(p)} className={`h-7 w-7 rounded-lg text-[12px] font-bold ${page === p ? "bg-[#096B4A] text-white" : "text-slate-500 hover:bg-slate-100"}`}>{p}</button>
                  );
                })}
                {totalPages > 5 && <span className="text-[12px] text-slate-400">...</span>}
                {totalPages > 5 && <button onClick={() => setPage(totalPages)} className={`h-7 w-7 rounded-lg text-[12px] font-bold ${page === totalPages ? "bg-[#096B4A] text-white" : "text-slate-500 hover:bg-slate-100"}`}>{totalPages}</button>}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40">Next</button>
              </div>
            </div>
          </div>
        )}

        {show2FAModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
            <Card className="w-full max-w-md">
              <h3 className="text-xl font-black text-[#101820]">2FA Required</h3>
              <input value={twoFactorCode} onChange={e => setTwoFactorCode(e.target.value)} placeholder="000000" className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#096B4A]" />
              <div className="mt-4 flex gap-3">
                <Button className="flex-1" onClick={() => void handle2FASubmit()}>Submit</Button>
                <Button className="flex-1" variant="ghost" onClick={() => setShow2FAModal(false)}>Cancel</Button>
              </div>
            </Card>
          </div>
        )}

        {showInvite && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" onClick={() => setShowInvite(false)}>
            <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <h3 className="text-xl font-black text-[#101820]">Invite Vendor</h3>
              <p className="mt-1 text-[13px] text-slate-400">Send an invitation email to a new vendor</p>
              <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} type="email" placeholder="vendor@example.com" className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-[13px] outline-none focus:border-[#096B4A]" />
              {inviteMsg && <p className="mt-2 text-[12px] text-emerald-600">{inviteMsg}</p>}
              <div className="mt-4 flex gap-3">
                <Button className="flex-1" onClick={() => {
                  if (!inviteEmail.includes("@")) return;
                  setInviteMsg(`Invitation sent to ${inviteEmail}`);
                  setInviteEmail("");
                  setTimeout(() => { setShowInvite(false); setInviteMsg(""); }, 1500);
                }}>Send Invite</Button>
                <Button className="flex-1" variant="ghost" onClick={() => { setShowInvite(false); setInviteEmail(""); setInviteMsg(""); }}>Cancel</Button>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}

function VendorAvatar({ vendor }: { vendor: Vendor }) {
  if (vendor.coverImage || vendor.avatar) {
    return <Image src={vendor.coverImage || vendor.avatar || ""} alt="" width={40} height={40} unoptimized className="h-10 w-10 rounded-full object-cover" />;
  }
  const colors = ["bg-emerald-100 text-emerald-700", "bg-blue-100 text-blue-700", "bg-amber-100 text-amber-700", "bg-purple-100 text-purple-700", "bg-red-100 text-red-700"];
  const idx = vendor.storeName.charCodeAt(0) % colors.length;
  return <div className={`flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-black ${colors[idx]}`}>{vendor.storeName?.charAt(0).toUpperCase() || "E"}</div>;
}

function VerifBadge({ status }: { status: string }) {
  if (status === "verified") return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-600">Verified</span>;
  if (status === "rejected") return <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-500">Failed</span>;
  return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-600">Pending</span>;
}

function StatusBdg({ status }: { status: string }) {
  if (status === "active") return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-600">Approved</span>;
  if (status === "suspended") return <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-500">Suspended</span>;
  return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-600">Pending</span>;
}

function SubBadge({ plan, status }: { plan: string; status?: string }) {
  const expired = status === "expired" || status === "cancelled";
  if (expired) return <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-500">Expired</span>;
  if (plan === "free") return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">Free</span>;
  if (status === "trial") return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-600">Trial</span>;
  return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-600">Paid</span>;
}
