"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Badge, Button, Card, EmptyState, ErrorPanel, LoadingPanel, PageHeader, TwoFactorModal } from "@/components/AdminUI";
import { usersAPI } from "@/lib/services/users.api";
import { User, UserRole } from "@/types";
import { APIError } from "@/lib/api";
import { useTwoFactorAction } from "@/lib/hooks/useTwoFactorAction";

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const twoFactor = useTwoFactorAction();

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await usersAPI.getUsers({
        role: roleFilter === "all" ? undefined : roleFilter,
      });
      setUsers(data);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleAction = (userId: string, action: "suspend" | "unsuspend") => {
    if (!confirm(`Are you sure you want to ${action} this account?`)) return;
    setActionLoading(userId);
    void twoFactor
      .run(async (code) => {
        if (action === "suspend") {
          await usersAPI.suspendUser(userId, "Suspended by admin", code);
        } else {
          await usersAPI.unsuspendUser(userId, code);
        }
        await loadUsers();
      })
      .finally(() => setActionLoading(null));
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <LoadingPanel label="Loading users..." />
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <PageHeader title="Users" subtitle="Manage platform users" />

          {error ? <ErrorPanel message={error} onRetry={() => void loadUsers()} /> : null}
          {twoFactor.error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{twoFactor.error}</div>
          ) : null}

          <Card>
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
          </Card>

          {users.length === 0 ? (
            <EmptyState title="No users found" />
          ) : (
            <Card className="overflow-hidden p-0">
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
                        <td className="px-6 py-4 text-sm"><Badge tone="blue">{user.role}</Badge></td>
                        <td className="px-6 py-4 text-sm"><Badge tone={user.status === "active" ? "green" : "red"}>{user.status}</Badge></td>
                        <td className="px-6 py-4 text-sm text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-3" onClick={(event) => event.stopPropagation()}>
                            <Button variant="ghost" onClick={() => router.push(`/users/${user.id}`)}>View</Button>
                            {user.role === "ADMIN" ? (
                              <span className="text-xs text-gray-400">Protected</span>
                            ) : user.status === "suspended" ? (
                              <Button
                                variant="secondary"
                                disabled={actionLoading === user.id || twoFactor.loading}
                                onClick={() => handleAction(user.id, "unsuspend")}
                              >
                                Unsuspend
                              </Button>
                            ) : (
                              <Button
                                variant="danger"
                                disabled={actionLoading === user.id || twoFactor.loading}
                                onClick={() => handleAction(user.id, "suspend")}
                              >
                                Suspend
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <div className="text-sm text-gray-500">Showing {users.length} users</div>
        </div>

        <TwoFactorModal
          open={twoFactor.show2FAModal}
          code={twoFactor.code}
          onCodeChange={twoFactor.setCode}
          onSubmit={() => void twoFactor.submit2FA()}
          onCancel={twoFactor.cancel2FA}
          loading={twoFactor.loading}
          error={twoFactor.error}
        />
      </AdminLayout>
    </ProtectedRoute>
  );
}
