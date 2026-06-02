"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { vendorsAPI } from "@/lib/services/vendors.api";
import { Vendor, VendorStatus } from "@/types";
import { APIError, API2FARequiredError } from "@/lib/api";

export default function VendorsPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<VendorStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ vendorId: string; action: string } | null>(null);

  const loadVendors = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await vendorsAPI.getVendors({
        status: statusFilter === "all" ? undefined : statusFilter,
        search: searchQuery || undefined,
      });
      setVendors(data);
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.message);
      } else {
        setError("Failed to load vendors");
      }
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    void loadVendors();
  }, [loadVendors]);

  const performAction = async (
    vendorId: string,
    action: "approve" | "reject" | "suspend" | "unsuspend",
    code?: string,
  ) => {
    if (action === "approve") {
      await vendorsAPI.approveVendor(vendorId);
    } else if (action === "reject") {
      await vendorsAPI.rejectVendor(vendorId);
    } else if (action === "suspend") {
      await vendorsAPI.suspendVendor(vendorId, code);
    } else if (action === "unsuspend") {
      await vendorsAPI.unsuspendVendor(vendorId, code);
    }
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
      } else if (err instanceof APIError) {
        alert(err.message);
      } else {
        alert(`Failed to ${action} vendor`);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handle2FASubmit = async () => {
    if (!pendingAction || !twoFactorCode) return;

    try {
      setActionLoading(pendingAction.vendorId);
      await performAction(
        pendingAction.vendorId,
        pendingAction.action as "approve" | "reject" | "suspend" | "unsuspend",
        twoFactorCode,
      );
      await loadVendors();
      setShow2FAModal(false);
      setTwoFactorCode("");
      setPendingAction(null);
    } catch (err) {
      if (err instanceof APIError) {
        alert(err.message);
      }
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading vendors...</p>
            </div>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Vendors</h1>
            <p className="mt-1 text-sm text-gray-600">Manage marketplace vendors</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
              <button onClick={loadVendors} className="ml-4 underline">
                Retry
              </button>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white p-4 rounded-lg shadow space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <input
                  type="text"
                  placeholder="Search by store name or owner..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && loadVendors()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as VendorStatus | "all")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
            <button
              onClick={loadVendors}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
            >
              Apply Filters
            </button>
          </div>

          {/* Vendors Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {vendors.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No vendors found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Products</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {vendors.map((vendor) => (
                      <tr
                        key={vendor.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => router.push(`/vendors/${vendor.id}`)}
                        onMouseEnter={() => void vendorsAPI.preloadVendor(vendor.id)}
                      >
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{vendor.storeName}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{vendor.ownerName}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {vendor.city}, {vendor.country}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{vendor.totalProducts}</td>
                        <td className="px-6 py-4 text-sm">
                          <StatusBadge status={vendor.adminStatus} />
                        </td>
                        <td className="px-6 py-4 text-sm space-x-2">
                          {vendor.adminStatus === "pending" && (
                            <>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleAction(vendor.id, "approve");
                                }}
                                disabled={actionLoading === vendor.id}
                                className="text-green-600 hover:text-green-900 font-medium disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleAction(vendor.id, "reject");
                                }}
                                disabled={actionLoading === vendor.id}
                                className="text-red-600 hover:text-red-900 font-medium disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {vendor.adminStatus === "active" && (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleAction(vendor.id, "suspend");
                              }}
                              disabled={actionLoading === vendor.id}
                              className="text-red-600 hover:text-red-900 font-medium disabled:opacity-50"
                            >
                              Suspend
                            </button>
                          )}
                          {vendor.adminStatus === "suspended" && (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleAction(vendor.id, "unsuspend");
                              }}
                              disabled={actionLoading === vendor.id}
                              className="text-green-600 hover:text-green-900 font-medium disabled:opacity-50"
                            >
                              Unsuspend
                            </button>
                          )}
                          <Link
                            href={`/vendors/${vendor.id}`}
                            prefetch
                            onMouseEnter={() => void vendorsAPI.preloadVendor(vendor.id)}
                            onClick={(event) => event.stopPropagation()}
                            className="text-primary-600 hover:text-primary-900 font-medium"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="text-sm text-gray-500">Showing {vendors.length} vendors</div>
        </div>

        {/* 2FA Modal */}
        {show2FAModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShow2FAModal(false)}></div>
              <div className="relative bg-white rounded-lg max-w-md w-full p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">2FA Required</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Enter 2FA Code</label>
                    <input
                      type="text"
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                      placeholder="000000"
                    />
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={handle2FASubmit}
                      className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                    >
                      Submit
                    </button>
                    <button
                      onClick={() => {
                        setShow2FAModal(false);
                        setTwoFactorCode("");
                        setPendingAction(null);
                      }}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    active: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    suspended: "bg-red-100 text-red-800",
  }[status] || "bg-gray-100 text-gray-800";

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors}`}>
      {status}
    </span>
  );
}
