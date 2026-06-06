"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { API2FARequiredError, APIError } from "@/lib/api";
import { SUPPORTED_CURRENCIES, formatDisplayMoney, useAdminDisplayCurrency } from "@/lib/displayCurrency";
import { payoutRequestsAPI } from "@/lib/services/payout-requests.api";
import { vendorsAPI } from "@/lib/services/vendors.api";
import { AdminPayoutRequest, Vendor } from "@/types";

type PayoutStatusFilter = "ALL" | AdminPayoutRequest["status"];

export default function PayoutRequestsPage() {
  const [items, setItems] = useState<AdminPayoutRequest[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<PayoutStatusFilter>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingPaidRequest, setPendingPaidRequest] = useState<AdminPayoutRequest | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [rejectingRequest, setRejectingRequest] = useState<AdminPayoutRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const { selectedCurrency, setSelectedCurrency } = useAdminDisplayCurrency(items[0]?.currency ?? "GBP");

  const vendorNameMap = useMemo(
    () =>
      new Map(
        vendors.map((vendor) => [
          vendor.id,
          {
            storeName: vendor.storeName,
            ownerName: vendor.ownerName,
          },
        ]),
      ),
    [vendors],
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [payouts, vendorList] = await Promise.all([
        payoutRequestsAPI.getPayoutRequests(statusFilter === "ALL" ? undefined : statusFilter),
        vendorsAPI.getVendors().catch(() => []),
      ]);
      setItems(payouts);
      setVendors(vendorList);
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.message);
      } else {
        setError("Failed to load payout requests");
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleApprove = async (item: AdminPayoutRequest) => {
    try {
      setBusyId(item.id);
      await payoutRequestsAPI.approvePayoutRequest(item.id);
      await loadData();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to approve payout request");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectingRequest) return;

    try {
      setBusyId(rejectingRequest.id);
      await payoutRequestsAPI.rejectPayoutRequest(rejectingRequest.id, rejectionReason || undefined);
      setRejectingRequest(null);
      setRejectionReason("");
      await loadData();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to reject payout request");
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkPaid = async (item: AdminPayoutRequest, code?: string) => {
    try {
      setBusyId(item.id);
      await payoutRequestsAPI.markPayoutRequestPaid(item.id, code);
      setPendingPaidRequest(null);
      setTwoFactorCode("");
      await loadData();
    } catch (err) {
      if (err instanceof API2FARequiredError) {
        setPendingPaidRequest(item);
      } else {
        alert(err instanceof APIError ? err.message : "Failed to mark payout as paid");
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Payout Requests</h1>
              <p className="mt-1 text-sm text-gray-600">
                Review vendor withdrawal requests, approve them, and mark escrow payouts as paid.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadData()}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>

          {error ? (
            <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {error}
            </div>
          ) : null}

          <section className="rounded-lg bg-white p-4 shadow">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Filter by status</label>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as PayoutStatusFilter)}
                  className="max-w-xs rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                >
                  <option value="ALL">All</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="PAID">Paid</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Display Currency</label>
                <select
                  value={selectedCurrency}
                  onChange={(event) => setSelectedCurrency(event.target.value as (typeof SUPPORTED_CURRENCIES)[number])}
                  className="max-w-xs rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                >
                  {SUPPORTED_CURRENCIES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="rounded-lg bg-white p-6 shadow">
            {loading ? (
              <div className="py-12 text-center text-sm text-gray-500">Loading payout requests...</div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500">No payout requests found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Vendor</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Notes</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Created</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {items.map((item) => {
                      const vendorMeta = vendorNameMap.get(item.vendorId);
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <div className="font-medium">{vendorMeta?.storeName ?? item.vendorId}</div>
                            <div className="text-xs text-gray-500">{vendorMeta?.ownerName ?? "Unknown owner"}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatDisplayMoney(item.amount, item.currency, selectedCurrency)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                item.status === "PENDING"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : item.status === "APPROVED"
                                    ? "bg-blue-100 text-blue-800"
                                    : item.status === "PAID"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-red-100 text-red-800"
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            <div>{item.notes || "No notes"}</div>
                            {item.rejectionReason ? (
                              <div className="mt-1 text-xs text-red-600">{item.rejectionReason}</div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {new Date(item.createdAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex flex-wrap gap-2">
                              {item.status === "PENDING" ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={busyId === item.id}
                                    onClick={() => void handleApprove(item)}
                                    className="font-medium text-green-600 hover:text-green-700 disabled:opacity-50"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busyId === item.id}
                                    onClick={() => setRejectingRequest(item)}
                                    className="font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                                  >
                                    Reject
                                  </button>
                                </>
                              ) : null}
                              {item.status === "APPROVED" ? (
                                <button
                                  type="button"
                                  disabled={busyId === item.id}
                                  onClick={() => void handleMarkPaid(item)}
                                  className="font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50"
                                >
                                  Mark paid
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {pendingPaidRequest ? (
          <Modal
            title="2FA required"
            onClose={() => {
              setPendingPaidRequest(null);
              setTwoFactorCode("");
            }}
          >
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Enter your 2FA code to mark payout <span className="font-medium">{pendingPaidRequest.id}</span> as paid.
              </p>
              <input
                type="text"
                value={twoFactorCode}
                onChange={(event) => setTwoFactorCode(event.target.value)}
                placeholder="Enter 2FA code"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-primary-500"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => void handleMarkPaid(pendingPaidRequest, twoFactorCode)}
                  className="flex-1 rounded-md bg-primary-600 px-4 py-2 text-white hover:bg-primary-700"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingPaidRequest(null);
                    setTwoFactorCode("");
                  }}
                  className="flex-1 rounded-md bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </Modal>
        ) : null}

        {rejectingRequest ? (
          <Modal
            title="Reject payout request"
            onClose={() => {
              setRejectingRequest(null);
              setRejectionReason("");
            }}
          >
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Add an optional rejection reason for the vendor.</p>
              <textarea
                rows={4}
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder="Explain why this payout is being rejected"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-primary-500"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => void handleReject()}
                  className="flex-1 rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                >
                  Reject request
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRejectingRequest(null);
                    setRejectionReason("");
                  }}
                  className="flex-1 rounded-md bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </Modal>
        ) : null}
      </AdminLayout>
    </ProtectedRoute>
  );
}

function Modal({
  children,
  onClose,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose}></div>
        <div className="relative w-full max-w-md rounded-lg bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">{title}</h3>
          {children}
        </div>
      </div>
    </div>
  );
}
