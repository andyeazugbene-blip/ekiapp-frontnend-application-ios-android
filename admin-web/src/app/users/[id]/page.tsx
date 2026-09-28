"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader, TextLink, TwoFactorModal } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { usersAPI } from "@/lib/services/users.api";
import { User } from "@/types";
import { APIError } from "@/lib/api";
import { formatDisplayMoney, useAdminDisplayCurrency } from "@/lib/displayCurrency";
import { countryDisplayName } from "@/lib/countries";
import { useTwoFactorAction } from "@/lib/hooks/useTwoFactorAction";

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const { selectedCurrency } = useAdminDisplayCurrency("GBP");
  const twoFactor = useTwoFactorAction();

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
          <LoadingPanel label="Loading user..." />
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  if (error || !user) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <ErrorPanel message={error || "User not found"} onRetry={() => router.push("/users")} />
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <PageHeader
            title={user.name || "User Details"}
            subtitle={`User ID: ${user.id}`}
            actions={<Button variant="secondary" onClick={() => router.push("/users")}>← Back to Users</Button>}
          />

          {twoFactor.error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{twoFactor.error}</div>
          ) : null}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="mb-4 text-lg font-bold text-gray-900">Profile</h2>
              <div className="space-y-3">
                <InfoRow label="Name" value={user.name || "N/A"} />
                <InfoRow label="Email" value={user.email || "N/A"} />
                <InfoRow label="Phone" value={user.phone || "—"} />
                <InfoRow label="Country" value={user.country ? countryDisplayName(user.country) : "—"} />
                <InfoRow label="Role" value={<Badge tone="blue">{user.role}</Badge>} />
                <InfoRow label="Status" value={<Badge tone={user.status === "active" ? "green" : "red"}>{user.status}</Badge>} />
                <InfoRow label="Email verified" value={user.emailVerifiedAt ? new Date(user.emailVerifiedAt).toLocaleString() : "No"} />
                <InfoRow label="Trust score" value={typeof user.trustScore === "number" ? String(user.trustScore) : "—"} />
              </div>
            </Card>

            <Card>
              <h2 className="mb-4 text-lg font-bold text-gray-900">Activity</h2>
              <div className="space-y-3">
                <InfoRow label="Joined" value={user.createdAt ? new Date(user.createdAt).toLocaleString() : "N/A"} />
                <InfoRow label="Total orders (as buyer)" value={String(user.orderCount ?? 0)} />
                <InfoRow label="Suspension reason" value={user.suspendedReason || "None"} />
                <InfoRow
                  label="Full activity log"
                  value={<TextLink href={`/activity-logs?entityType=User&entityId=${user.id}`}>View entries →</TextLink>}
                />
                <InfoRow
                  label="Support messages"
                  value={
                    user.supportConversationId ? (
                      <TextLink href={`/support-messages/${user.supportConversationId}`}>Open conversation →</TextLink>
                    ) : (
                      "No conversation started"
                    )
                  }
                />
              </div>
            </Card>
          </div>

          {/* This account may hold more than one capability at once (the
              universal-account model) — show whichever of these actually
              apply, nothing invented for the ones that don't. */}
          {user.vendor || user.organiserProfile || user.supplierAccount ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {user.vendor ? (
                <Card>
                  <h2 className="mb-4 text-lg font-bold text-gray-900">Vendor Profile</h2>
                  <div className="space-y-3">
                    <InfoRow label="Store" value={user.vendor.storeName} />
                    <InfoRow label="Verification" value={<Badge tone={user.vendor.verificationStatus === "APPROVED" ? "green" : user.vendor.verificationStatus === "REJECTED" ? "red" : "amber"}>{user.vendor.verificationStatus?.replace(/_/g, " ") ?? "pending"}</Badge>} />
                    <InfoRow label="Suspended" value={user.vendor.isSuspended ? "Yes" : "No"} />
                    <TextLink href={`/vendors/${user.vendor.id}`}>Open vendor profile →</TextLink>
                  </div>
                </Card>
              ) : null}

              {user.organiserProfile ? (
                <Card>
                  <h2 className="mb-4 text-lg font-bold text-gray-900">Community Buy Organiser</h2>
                  <div className="space-y-3">
                    <InfoRow label="Verified" value={user.organiserProfile.isVerified ? "Yes" : "No"} />
                    <InfoRow label="Restricted" value={user.organiserProfile.isRestricted ? "Yes" : "No"} />
                    <InfoRow label="Market" value={user.organiserProfile.country ? countryDisplayName(user.organiserProfile.country) : "—"} />
                  </div>
                </Card>
              ) : null}

              {user.supplierAccount ? (
                <Card>
                  <h2 className="mb-4 text-lg font-bold text-gray-900">Supplier Account</h2>
                  <div className="space-y-3">
                    <InfoRow label="State" value={user.supplierAccount.supplierState?.replace(/_/g, " ") ?? "—"} />
                    <InfoRow label="Charges enabled" value={user.supplierAccount.chargesEnabled ? "Yes" : "No"} />
                    <TextLink href={`/community-supplier-accounts?userId=${user.id}`}>Open supplier accounts →</TextLink>
                  </div>
                </Card>
              ) : null}
            </div>
          ) : null}

          <Card>
            <h2 className="mb-4 text-lg font-bold text-gray-900">Recent Orders ({user.recentOrders?.length ?? 0})</h2>
            {!user.recentOrders || user.recentOrders.length === 0 ? (
              <p className="text-sm text-gray-500">No orders as a buyer.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Order #</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {user.recentOrders.map((o) => (
                      <tr key={o.id} className="cursor-pointer hover:bg-gray-50" onClick={() => router.push(`/orders/${o.id}`)}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{o.orderNumber}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{formatDisplayMoney((o.totalAmount ?? 0) / 100, o.currency, selectedCurrency)}</td>
                        <td className="px-4 py-3 text-sm"><OrderStatusBadge status={o.status} /></td>
                        <td className="px-4 py-3 text-sm text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(user.orderCount ?? 0) > (user.recentOrders?.length ?? 0) ? (
              <p className="mt-3 text-xs text-gray-400">Showing the {user.recentOrders?.length} most recent of {user.orderCount} total orders.</p>
            ) : null}
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-bold text-gray-900">Admin Actions</h2>
            <div className="flex flex-wrap gap-3">
              {user.role === "ADMIN" ? (
                <span className="text-sm text-gray-400">Admin accounts can&apos;t be suspended or deleted here.</span>
              ) : user.status === "suspended" ? (
                <Button
                  disabled={twoFactor.loading}
                  onClick={() => {
                    if (!confirm("Unsuspend this account?")) return;
                    void twoFactor.run(async (code) => {
                      await usersAPI.unsuspendUser(user.id, code);
                      await loadUser();
                    });
                  }}
                >
                  Unsuspend
                </Button>
              ) : (
                <Button
                  variant="danger"
                  disabled={twoFactor.loading}
                  onClick={() => {
                    if (!confirm("Suspend this account?")) return;
                    const reason = prompt("Reason for suspension (for the audit log):") ?? undefined;
                    void twoFactor.run(async (code) => {
                      await usersAPI.suspendUser(user.id, reason, code);
                      await loadUser();
                    });
                  }}
                >
                  Suspend
                </Button>
              )}
              <Button variant="secondary" onClick={() => router.push(`/activity-logs?entityType=User&entityId=${user.id}`)}>View Activity Log</Button>
              {user.supportConversationId ? (
                <Button variant="secondary" onClick={() => router.push(`/support-messages/${user.supportConversationId}`)}>Open Support Conversation</Button>
              ) : null}
            </div>
          </Card>
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

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-sm font-medium text-gray-500">{label}:</span>
      <span className="text-sm text-gray-900 text-right break-all">{value}</span>
    </div>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase() ?? "";
  const colors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    paid: "bg-blue-100 text-blue-800",
    confirmed: "bg-blue-100 text-blue-800",
    processing: "bg-purple-100 text-purple-800",
    dispatched: "bg-purple-100 text-purple-800",
    in_transit: "bg-purple-100 text-purple-800",
    delivered: "bg-green-100 text-green-800",
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    cancelled: "bg-red-100 text-red-800",
    refunded: "bg-gray-100 text-gray-800",
  };
  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${colors[s] ?? "bg-gray-100 text-gray-800"}`}>{s.replace("_", " ")}</span>;
}
