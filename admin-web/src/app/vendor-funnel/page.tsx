"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, EmptyState, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import { formatDateTime } from "@/components/AdminKit";
import { adminAPI } from "@/lib/services/admin.api";
import { APIError } from "@/lib/api";
import type { VendorFunnelResult } from "@/types";

type RangeKey = "7d" | "30d" | "90d" | "365d";
const RANGES: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "365d", label: "Last 12 months" },
];

function barWidth(pct: number): string {
  return `${Math.max(2, Math.min(100, pct))}%`;
}

export default function VendorFunnelPage() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [data, setData] = useState<VendorFunnelResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (r: RangeKey) => {
    setLoading(true);
    setError("");
    try {
      setData(await adminAPI.getVendorOnboardingFunnel(r));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Could not load the vendor onboarding funnel.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(range);
  }, [range, load]);

  return (
    <ProtectedRoute>
      <AdminLayout>
        <PageHeader
          title="Vendor onboarding funnel"
          subtitle="Where new vendors drop off between registering and getting a store people can actually buy from — so marketing spend isn't acquiring vendors who are then lost silently."
        />

        <div className="mb-6 flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                range === r.key
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-emerald-300"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingPanel label="Loading the onboarding funnel..." />
        ) : error ? (
          <ErrorPanel message={error} onRetry={() => void load(range)} />
        ) : !data || data.cohortSize === 0 ? (
          <EmptyState title="No vendors registered in this window." />
        ) : (
          <>
            <Card className="mb-6">
              <p className="mb-4 text-sm text-gray-500">
                {data.cohortSize} vendor{data.cohortSize === 1 ? "" : "s"} registered since{" "}
                {formatDateTime(data.since)}. A step counts a vendor as soon as they ever reach it, even after
                this window — this measures where the drop-off happens, not just who converted fast.
              </p>
              <div className="space-y-4">
                {data.steps.map((step, i) => (
                  <div key={step.id}>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className="font-semibold text-gray-900">
                        {i + 1}. {step.label}
                      </span>
                      <span className="text-gray-600">
                        {step.vendorCount} vendor{step.vendorCount === 1 ? "" : "s"}
                        {" · "}
                        {step.conversionFromStart}% of all registered
                        {i > 0 && (
                          <>
                            {" · "}
                            <span className={step.conversionFromPrevious < 50 ? "font-semibold text-red-600" : ""}>
                              {step.conversionFromPrevious}% of the step before
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full ${i === 0 ? "bg-emerald-600" : step.conversionFromPrevious < 50 ? "bg-red-500" : "bg-emerald-500"}`}
                        style={{ width: barWidth(step.conversionFromStart) }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      {i > 0 && step.droppedHere > 0 && (
                        <span>
                          {step.droppedHere} vendor{step.droppedHere === 1 ? "" : "s"} reached the previous step but never got here.{" "}
                        </span>
                      )}
                      {step.medianDaysFromRegistration !== null && (
                        <span>Median {step.medianDaysFromRegistration} day{step.medianDaysFromRegistration === 1 ? "" : "s"} after registering.</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h2 className="mb-1 text-base font-semibold text-gray-900">
                Registered but never added a product ({data.stuckAtRegistration.length})
              </h2>
              <p className="mb-4 text-sm text-gray-500">
                These are the vendors marketing spend acquired in this window who are at risk of being lost
                entirely — they never reached the first real onboarding step.
              </p>
              {data.stuckAtRegistration.length === 0 ? (
                <p className="text-sm text-gray-400">Every vendor in this window added at least one product.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                        <th className="py-2 pr-4">Store</th>
                        <th className="py-2 pr-4">Email</th>
                        <th className="py-2 pr-4">Registered</th>
                        <th className="py-2 pr-4">Days ago</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.stuckAtRegistration.map((v) => (
                        <tr key={v.vendorId} className="border-b border-gray-50">
                          <td className="py-2 pr-4 font-medium text-gray-900">{v.storeName}</td>
                          <td className="py-2 pr-4 text-gray-500">{v.email ?? "—"}</td>
                          <td className="py-2 pr-4 text-gray-500">{formatDateTime(v.registeredAt)}</td>
                          <td className="py-2 pr-4 text-gray-500">{v.daysSinceRegistration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
