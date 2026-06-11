"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { paymentsAPI, AdminPayment } from "@/lib/services/payments.api";
import { APIError } from "@/lib/api";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const loadPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setPayments(await paymentsAPI.getPayments({
        status: statusFilter === "all" ? undefined : statusFilter,
      }));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  if (loading) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="flex h-64 items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary-600 mx-auto"></div>
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
            <h1 className="text-3xl font-bold text-gray-900">Payments</h1>
            <p className="mt-1 text-sm text-gray-600">Track all payment transactions on the platform.</p>
          </div>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {error}
              <button onClick={loadPayments} className="ml-4 underline">Retry</button>
            </div>
          )}

          <div className="rounded-lg bg-white p-4 shadow">
            <label className="mb-2 block text-sm font-medium text-gray-700">Filter by Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 md:w-64"
            >
              <option value="all">All Payments</option>
              <option value="SUCCEEDED">Succeeded</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>

          <div className="overflow-hidden rounded-lg bg-white shadow">
            {payments.length === 0 ? (
              <div className="py-12 text-center text-gray-500">No payments found.</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Order</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Buyer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Vendor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{payment.orderNumber}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{payment.buyerName}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{payment.vendorName}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {payment.currency} {payment.amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                          payment.status === "SUCCEEDED" ? "bg-green-100 text-green-800" :
                          payment.status === "FAILED" ? "bg-red-100 text-red-800" :
                          payment.status === "REFUNDED" ? "bg-amber-100 text-amber-800" :
                          "bg-gray-100 text-gray-800"
                        }`}>
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <p className="text-sm text-gray-500">Showing {payments.length} payments</p>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
