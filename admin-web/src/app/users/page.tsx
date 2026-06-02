"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { usersAPI } from "@/lib/services/users.api";
import { User, UserRole } from "@/types";
import { API2FARequiredError, APIError } from "@/lib/api";

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ userId: string; action: "suspend" | "unsuspend" } | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await usersAPI.getUsers({
        role: roleFilter === "all" ? undefined : roleFilter,
      });
      setUsers(data);
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.message);
      } else {
        setError("Failed to load users");
      }
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const performAction = async (userId: string, action: "suspend" | "unsuspend", code?: string) => {
    if (action === "suspend") {
      await usersAPI.suspendUser(userId, "Suspended by admin", code);
      return;
    }

    await usersAPI.unsuspendUser(userId, code);
  };

  const handleAction = async (userId: string, action: "suspend" | "unsuspend") => {
    if (!confirm(`Are you sure you want to ${action} this account?`)) return;

    try {
      setActionLoading(userId);
      await performAction(userId, action);
      await loadUsers();
    } catch (err) {
      if (err instanceof API2FARequiredError) {
        setPendingAction({ userId, action });
        setShow2FAModal(true);
      } else if (err instanceof APIError) {
        alert(err.message);
      } else {
        alert(`Failed to ${action} account`);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handle2FASubmit = async () => {
    if (!pendingAction || !twoFactorCode) return;

    try {
      setActionLoading(pendingAction.userId);
      await performAction(pendingAction.userId, pendingAction.action, twoFactorCode);
      await loadUsers();
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
          <div className="flex h-64 items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
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
            <h1 className="text-3xl font-bold text-gray-900">Users</h1>
            <p className="mt-1 text-sm text-gray-600">Manage platform users</p>
          </div>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {error}
              <button onClick={loadUsers} className="ml-4 underline">
                Retry
              </button>
            </div>
          )}

          <div className="rounded-lg bg-white p-4 shadow">
            <label className="mb-2 block text-sm font-medium text-gray-700">Filter by Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as UserRole | "all")}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 md:w-64"
            >
              <option value="all">All Roles</option>
              <option value="BUYER">Buyers</option>
              <option value="VENDOR">Vendors</option>
              <option value="ADMIN">Admins</option>
            </select>
          </div>

          <div className="overflow-hidden rounded-lg bg-white shadow">
            {users.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-gray-500">No users found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Joined</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr
                        key={user.id}
                        className="cursor-pointer transition-colors hover:bg-gray-50"
                        onClick={() => router.push(`/users/${user.id}`)}
                        onMouseEnter={() => void usersAPI.preloadUser(user.id)}
                      >
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{user.email}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${
                              user.status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                            }`}
                          >
                            {user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-3">
                            <Link
                              href={`/users/${user.id}`}
                              prefetch
                              onMouseEnter={() => void usersAPI.preloadUser(user.id)}
                              onClick={(event) => event.stopPropagation()}
                              className="font-medium text-primary-600 hover:text-primary-900"
                            >
                              View
                            </Link>
                            {user.role !== "ADMIN" ? (
                              user.status === "suspended" ? (
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleAction(user.id, "unsuspend");
                                  }}
                                  disabled={actionLoading === user.id}
                                  className="font-medium text-green-600 hover:text-green-900 disabled:opacity-50"
                                >
                                  Unsuspend
                                </button>
                              ) : (
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleAction(user.id, "suspend");
                                  }}
                                  disabled={actionLoading === user.id}
                                  className="font-medium text-red-600 hover:text-red-900 disabled:opacity-50"
                                >
                                  Suspend
                                </button>
                              )
                            ) : (
                              <span className="text-xs text-gray-400">Protected</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="text-sm text-gray-500">Showing {users.length} users</div>
        </div>

        {show2FAModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center px-4">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShow2FAModal(false)}></div>
              <div className="relative w-full max-w-md rounded-lg bg-white p-6">
                <h3 className="mb-4 text-lg font-semibold text-gray-900">2FA Required</h3>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Enter 2FA Code</label>
                    <input
                      type="text"
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                      placeholder="000000"
                    />
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={handle2FASubmit}
                      className="flex-1 rounded-md bg-primary-600 px-4 py-2 text-white hover:bg-primary-700"
                    >
                      Submit
                    </button>
                    <button
                      onClick={() => {
                        setShow2FAModal(false);
                        setTwoFactorCode("");
                        setPendingAction(null);
                      }}
                      className="flex-1 rounded-md bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
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
