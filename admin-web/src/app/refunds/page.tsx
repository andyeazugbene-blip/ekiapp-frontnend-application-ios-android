"use client";

import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function RefundsPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Refunds</h1>
            <p className="mt-1 text-sm text-gray-600">Manage order refunds</p>
          </div>

          <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-blue-700">
            <p className="font-medium">Refunds are managed from Order Details</p>
            <p className="mt-1 text-sm">
              Navigate to Orders - select an order - click &quot;Issue Refund&quot; to process the refund.
            </p>
            <p className="mt-2 text-sm">
              Refunds are processed through the payment provider integration automatically.
            </p>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">How refunds work</h2>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>Refunds can be full or partial amounts.</li>
              <li>2FA can be required for sensitive refund operations.</li>
              <li>Duplicate refunds are prevented with a 409 conflict response.</li>
              <li>Refunds are processed by the payment provider backend.</li>
              <li>Order status updates to &quot;refunded&quot; after successful processing.</li>
            </ul>
          </div>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
