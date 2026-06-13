"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { walletTransactionsAPI, AdminWalletTransaction } from "@/lib/services/wallet-transactions.api";
import { APIError } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function WalletTransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<AdminWalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setTransactions(await walletTransactionsAPI.getWalletTransactions({
        type: typeFilter === "all" ? undefined : typeFilter,
      }));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load wallet transactions");
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

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
            <h1 className="text-3xl font-bold text-gray-900">Wallet Transactions</h1>
            <p className="mt-1 text-sm text-gray-600">View vendor wallet transactions and balances.</p>
          </div>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {error}
              <button onClick={loadTransactions} className="ml-4 underline">Retry</button>
            </div>
          )}

          <div className="rounded-lg bg-white p-4 shadow">
            <label className="mb-2 block text-sm font-medium text-gray-700">Filter by Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 md:w-64"
            >
              <option value="all">All Types</option>
              <option value="ORDER_PAYMENT">Order Payment</option>
              <option value="WITHDRAWAL">Withdrawal</option>
              <option value="REFUND">Refund</option>
              <option value="PLATFORM_FEE">Platform Fee</option>
            </select>
          </div>

          <div className="overflow-hidden rounded-lg bg-white shadow">
            {transactions.length === 0 ? (
              <div className="py-12 text-center text-gray-500">No wallet transactions found.</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Vendor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Balance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {transactions.map((tx) => (
                    <tr key={tx.id} onClick={() => router.push("/wallet-transactions/" + tx.id)} className="cursor-pointer hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{tx.vendorName}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                          tx.type === "ORDER_PAYMENT" ? "bg-green-100 text-green-800" :
                          tx.type === "WITHDRAWAL" ? "bg-red-100 text-red-800" :
                          tx.type === "REFUND" ? "bg-amber-100 text-amber-800" :
                          "bg-gray-100 text-gray-800"
                        }`}>
                          {tx.type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {tx.amount >= 0 ? "+" : ""}{tx.currency} {tx.amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {tx.currency} {tx.balance.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                        {tx.description || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <p className="text-sm text-gray-500">Showing {transactions.length} wallet transactions</p>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
