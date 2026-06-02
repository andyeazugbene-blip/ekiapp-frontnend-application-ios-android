"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { auditLogsAPI } from "@/lib/services/audit-logs.api";
import { AuditLogEntry } from "@/types";

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setLogs(await auditLogsAPI.getLogs());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load activity logs.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Activity Logs</h1>
            <p className="mt-1 text-sm text-gray-600">
              Review sign-ins and admin actions across buyers, vendors, and operations.
            </p>
          </div>

          {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">When</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Actor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Entity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">Loading activity…</td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No activity found.</td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="align-top">
                      <td className="px-4 py-4 text-sm text-gray-600">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        <div className="font-medium">{log.actor?.name ?? log.actorId}</div>
                        <div className="text-xs text-gray-500">{log.actor?.email ?? "Unknown actor"}</div>
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">{log.action}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        <div>{log.entityType}</div>
                        <div className="text-xs text-gray-500">{log.entityId ?? "—"}</div>
                      </td>
                      <td className="px-4 py-4 text-xs text-gray-600">
                        <pre className="whitespace-pre-wrap break-all rounded bg-gray-50 p-3">
                          {JSON.stringify(log.metadata ?? {}, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
