"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { SUPPORTED_CURRENCIES, formatDisplayMoney, useAdminDisplayCurrency } from "@/lib/displayCurrency";
import { ordersAPI } from "@/lib/services/orders.api";
import { Order } from "@/types";
import { APIError, API2FARequiredError } from "@/lib/api";

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundError, setRefundError] = useState("");
  const [refundSuccess, setRefundSuccess] = useState(false);
  const { selectedCurrency, setSelectedCurrency } = useAdminDisplayCurrency(order?.currency ?? "GBP");

  const loadOrder = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await ordersAPI.getOrder(orderId);
      setOrder(data);
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.message);
      } else {
        setError("Failed to load order");
      }
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const handleRefund = async () => {
    if (!refundReason.trim()) {
      setRefundError("Please provide a reason for the refund");
      return;
    }

    try {
      setRefundLoading(true);
      setRefundError("");

      const amount = refundAmount ? parseFloat(refundAmount) : undefined;
      
      await ordersAPI.refundOrder(orderId, {
        amount,
        reason: refundReason,
        twoFactorCode: twoFactorCode || undefined,
      });

      setRefundSuccess(true);
      setShowRefundModal(false);
      setShow2FAModal(false);
      setTimeout(() => {
        void loadOrder();
        setRefundSuccess(false);
      }, 2000);
    } catch (err) {
      if (err instanceof API2FARequiredError) {
        setShow2FAModal(true);
        setRefundError("2FA code required for this action");
      } else if (err instanceof APIError) {
        if (err.status === 409) {
          setRefundError("This order has already been refunded");
        } else {
          setRefundError(err.message);
        }
      } else {
        setRefundError("Failed to process refund");
      }
    } finally {
      setRefundLoading(false);
    }
  };

  const handleCompleteOrder = async () => {
    if (!confirm("Mark this order as completed?")) return;

    try {
      await ordersAPI.completeOrder(orderId);
      await loadOrder();
    } catch (err) {
      if (err instanceof APIError) {
        alert(err.message);
      } else {
        alert("Failed to complete order");
      }
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading order...</p>
            </div>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  if (error || !order) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error || "Order not found"}
            <button onClick={() => router.push("/orders")} className="ml-4 underline">
              Back to Orders
            </button>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => router.push("/orders")}
                className="text-sm text-gray-600 hover:text-gray-900 mb-2"
              >
                ← Back to Orders
              </button>
              <h1 className="text-3xl font-bold text-gray-900">Order {order.orderNumber}</h1>
              <p className="mt-1 text-sm text-gray-600">Order ID: {order.id}</p>
            </div>
            <div className="flex space-x-3">
              <select
                value={selectedCurrency}
                onChange={(event) => setSelectedCurrency(event.target.value as (typeof SUPPORTED_CURRENCIES)[number])}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900"
              >
                {SUPPORTED_CURRENCIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {order.status !== "refunded" && order.status !== "cancelled" && (
                <button
                  onClick={() => setShowRefundModal(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  Issue Refund
                </button>
              )}
              {order.status === "shipped" && (
                <button
                  onClick={handleCompleteOrder}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  Mark as Delivered
                </button>
              )}
            </div>
          </div>

          {refundSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              Refund processed successfully
            </div>
          )}

          {/* Order Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Order Information</h2>
              <div className="space-y-3">
                <InfoRow label="Status" value={<StatusBadge status={order.status} />} />
                <InfoRow label="Total Amount" value={formatDisplayMoney(order.totalAmount, order.currency, selectedCurrency)} />
                <InfoRow label="Payment Status" value={order.paymentStatus || "N/A"} />
                <InfoRow label="Order Date" value={new Date(order.createdAt).toLocaleString()} />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Parties</h2>
              <div className="space-y-3">
                <InfoRow label="Buyer" value={order.buyerName || order.buyerId} />
                <InfoRow label="Vendor" value={order.vendorName || order.vendorId} />
              </div>
            </div>
          </div>

          {/* Order Items */}
          {order.items && order.items.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Items</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {order.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.productTitle}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.quantity}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatDisplayMoney(item.price, order.currency, selectedCurrency)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatDisplayMoney(item.totalAmount, order.currency, selectedCurrency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Refund Modal */}
        {showRefundModal && (
          <Modal onClose={() => setShowRefundModal(false)} title="Issue Refund">
            <div className="space-y-4">
              {refundError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                  {refundError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Refund Amount (optional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder={`Full amount: ${formatDisplayMoney(order.totalAmount, order.currency, selectedCurrency)}`}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                />
                <p className="mt-1 text-xs text-gray-500">Leave empty for full refund</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason *
                </label>
                <textarea
                  rows={3}
                  placeholder="Explain why this refund is being issued..."
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                  required
                />
              </div>
              {show2FAModal && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    2FA Code *
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your 2FA code"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                    required
                  />
                </div>
              )}
              <div className="flex space-x-3">
                <button
                  onClick={handleRefund}
                  disabled={refundLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {refundLoading ? "Processing..." : "Confirm Refund"}
                </button>
                <button
                  onClick={() => {
                    setShowRefundModal(false);
                    setShow2FAModal(false);
                    setRefundError("");
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-sm font-medium text-gray-500">{label}:</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-blue-100 text-blue-800",
    shipped: "bg-purple-100 text-purple-800",
    delivered: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
    refunded: "bg-gray-100 text-gray-800",
  }[status] || "bg-gray-100 text-gray-800";

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors}`}>
      {status}
    </span>
  );
}

function Modal({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose}></div>
        <div className="relative bg-white rounded-lg max-w-md w-full p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
          {children}
        </div>
      </div>
    </div>
  );
}
