"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { vendorsAPI } from "@/lib/services/vendors.api";
import { Vendor } from "@/types";
import { APIError } from "@/lib/api";

export default function VendorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const vendorId = params.id as string;

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadVendor = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await vendorsAPI.getVendor(vendorId);
      setVendor(data);
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.message);
      } else {
        setError("Failed to load vendor");
      }
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    void loadVendor();
  }, [loadVendor]);

  if (loading) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  if (error || !vendor) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error || "Vendor not found"}
            <button onClick={() => router.push("/vendors")} className="ml-4 underline">
              Back to Vendors
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
          <div>
            <button
              onClick={() => router.push("/vendors")}
              className="text-sm text-gray-600 hover:text-gray-900 mb-2"
            >
              ← Back to Vendors
            </button>
            <h1 className="text-3xl font-bold text-gray-900">{vendor.storeName}</h1>
            <p className="mt-1 text-sm text-gray-600">Vendor ID: {vendor.id}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Store Information</h2>
              <div className="space-y-3">
                <InfoRow label="Store Name" value={vendor.storeName} />
                <InfoRow label="Store Slug" value={vendor.storeSlug || "N/A"} />
                <InfoRow label="Owner" value={vendor.ownerName} />
                <InfoRow label="Location" value={`${vendor.city}, ${vendor.country}`} />
                <InfoRow label="Rating" value={`${vendor.rating.toFixed(1)} ⭐`} />
                <InfoRow label="Subscription" value={vendor.subscriptionPlan.toUpperCase()} />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Status & Metrics</h2>
              <div className="space-y-3">
                <InfoRow label="Status" value={<StatusBadge status={vendor.adminStatus} />} />
                <InfoRow label="Verification" value={<VerificationBadge status={vendor.verificationStatus} />} />
                <InfoRow label="Total Products" value={vendor.totalProducts} />
                <InfoRow label="Total Orders" value={vendor.totalOrders} />
                <InfoRow label="Joined" value={new Date(vendor.joinedAt).toLocaleDateString()} />
              </div>
            </div>
          </div>

          {vendor.description && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Description</h2>
              <p className="text-sm text-gray-600">{vendor.description}</p>
            </div>
          )}
        </div>
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

function VerificationBadge({ status }: { status: string }) {
  const colors = {
    verified: "bg-green-100 text-green-800",
    pending_docs: "bg-yellow-100 text-yellow-800",
    rejected: "bg-red-100 text-red-800",
  }[status] || "bg-gray-100 text-gray-800";

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors}`}>
      {status.replace("_", " ")}
    </span>
  );
}
