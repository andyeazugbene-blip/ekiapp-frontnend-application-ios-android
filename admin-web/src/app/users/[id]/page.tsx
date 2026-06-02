"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { usersAPI } from "@/lib/services/users.api";
import { User } from "@/types";
import { APIError } from "@/lib/api";

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadUser = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await usersAPI.getUser(userId);
      setUser(data);
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.message);
      } else {
        setError("Failed to load user");
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

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

  if (error || !user) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error || "User not found"}
            <button onClick={() => router.push("/users")} className="ml-4 underline">
              Back to Users
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
              onClick={() => router.push("/users")}
              className="text-sm text-gray-600 hover:text-gray-900 mb-2"
            >
              ← Back to Users
            </button>
            <h1 className="text-3xl font-bold text-gray-900">{user.name || "User Details"}</h1>
            <p className="mt-1 text-sm text-gray-600">User ID: {user.id}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
              <div className="space-y-3">
                <InfoRow label="Name" value={user.name || "N/A"} />
                <InfoRow label="Email" value={user.email || "N/A"} />
                <InfoRow label="Role" value={user.role} />
                <InfoRow label="Status" value={<StatusBadge status={user.status} />} />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Activity</h2>
              <div className="space-y-3">
                <InfoRow label="Joined" value={user.createdAt ? new Date(user.createdAt).toLocaleString() : "N/A"} />
                <InfoRow label="Suspension reason" value={user.suspendedReason || "None"} />
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-sm font-medium text-gray-500">{label}:</span>
      <span className="text-sm text-gray-900 text-right break-all">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    active: "bg-green-100 text-green-800",
    suspended: "bg-red-100 text-red-800",
    pending: "bg-yellow-100 text-yellow-800",
  }[status] || "bg-gray-100 text-gray-800";

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors}`}>
      {status}
    </span>
  );
}
