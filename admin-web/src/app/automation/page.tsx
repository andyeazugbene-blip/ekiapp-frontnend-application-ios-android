"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Card, ErrorPanel, LoadingPanel, MetricCard, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { automationAPI, type AutomationSummary } from "@/lib/services/automation.api";

export default function AutomationPage() {
  const [summary, setSummary] = useState<AutomationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      setSummary(await automationAPI.getSummary());
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load automation summary");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const sentCount = summary?.byStatus.find((s) => s.status === "SENT")?.count ?? 0;
  const failedCount = summary?.byStatus.find((s) => s.status === "FAILED")?.count ?? 0;
  const totalRuns = (summary?.byStatus ?? []).reduce((sum, s) => sum + s.count, 0);

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? <LoadingPanel label="Loading automation activity..." /> : (
          <div className="space-y-8">
            <PageHeader title="Automation" subtitle="Event-driven vendor/buyer automation runs over the last 30 days." />
            {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}

            <div className="grid gap-6 md:grid-cols-3">
              <MetricCard icon="trending" label="Total runs (30d)" value={totalRuns} tone="green" />
              <MetricCard icon="check" label="Sent" value={sentCount} tone="green" />
              <MetricCard icon="warning" label="Failed" value={failedCount} tone={failedCount > 0 ? "red" : "green"} />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <h2 className="text-2xl font-black">Runs by type</h2>
                {(summary?.byType ?? []).length === 0 ? (
                  <p className="mt-6 text-slate-500">No automation runs yet.</p>
                ) : (
                  <div className="mt-6 space-y-3">
                    {summary!.byType.map((t) => (
                      <div key={t.type} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                        <span className="text-sm font-semibold text-slate-700">{t.type.replace(/_/g, " ")}</span>
                        <span className="text-sm font-black text-[#101820]">{t.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <h2 className="text-2xl font-black">Recent failures</h2>
                {(summary?.recentFailures ?? []).length === 0 ? (
                  <p className="mt-6 text-slate-500">No failures in the last 30 days.</p>
                ) : (
                  <div className="mt-6 space-y-3">
                    {summary!.recentFailures.map((run) => (
                      <div key={run.id} className="rounded-xl border border-red-100 bg-red-50/40 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-800">{run.type.replace(/_/g, " ")}</span>
                          <Badge tone="red">Failed</Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{run.failureReason ?? "No reason recorded"}</p>
                        <p className="mt-1 text-xs text-slate-400">{new Date(run.createdAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
