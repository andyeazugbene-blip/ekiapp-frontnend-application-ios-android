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

function toDateInputValue(iso: string): string {
  return iso ? iso.slice(0, 10) : "";
}

export default function VendorFunnelPage() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [data, setData] = useState<VendorFunnelResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedStuck, setExpandedStuck] = useState<string | null>(null);

  const load = useCallback(async (r: RangeKey, custom: { from: string; to: string } | null) => {
    setLoading(true);
    setError("");
    try {
      setData(await adminAPI.getVendorOnboardingFunnel(r, custom ?? undefined));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Could not load the vendor onboarding funnel.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (useCustomRange && customFrom && customTo) {
      void load(range, { from: customFrom, to: customTo });
    } else if (!useCustomRange) {
      void load(range, null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, useCustomRange, customFrom, customTo, load]);

  return (
    <ProtectedRoute>
      <AdminLayout>
        <PageHeader
          title="Vendor onboarding funnel"
          subtitle="Where new vendors drop off between registering and getting a store people can actually buy from — so marketing spend isn't acquiring vendors who are then lost silently."
        />

        <div className="mb-3 flex flex-wrap items-center gap-2">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => {
                setUseCustomRange(false);
                setRange(r.key);
              }}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                !useCustomRange && range === r.key
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-emerald-300"
              }`}
            >
              {r.label}
            </button>
          ))}
          <button
            onClick={() => setUseCustomRange(true)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              useCustomRange ? "border-emerald-600 bg-emerald-600 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-emerald-300"
            }`}
          >
            Custom range
          </button>
        </div>

        {useCustomRange && (
          <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
            <label className="text-gray-500">
              From{" "}
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="ml-1 rounded-md border border-gray-200 px-2 py-1"
              />
            </label>
            <label className="text-gray-500">
              To{" "}
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="ml-1 rounded-md border border-gray-200 px-2 py-1"
              />
            </label>
            {!customFrom || !customTo ? <span className="text-xs text-gray-400">Pick both dates to apply.</span> : null}
          </div>
        )}

        {loading ? (
          <LoadingPanel label="Loading the onboarding funnel..." />
        ) : error ? (
          <ErrorPanel message={error} onRetry={() => void load(range, useCustomRange && customFrom && customTo ? { from: customFrom, to: customTo } : null)} />
        ) : !data || data.cohortSize === 0 ? (
          <EmptyState title="No vendors registered in this window." />
        ) : (
          <>
            <Card className="mb-6">
              <p className="mb-4 text-sm text-gray-500">
                {data.cohortSize} vendor{data.cohortSize === 1 ? "" : "s"} registered between{" "}
                {formatDateTime(data.since)} and {formatDateTime(data.until)}. A stage counts a vendor as soon as they
                ever reach it, even after this window — this measures where the drop-off happens, not just who
                converted fast.
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
                    <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
                      <span>
                        {i > 0 && step.droppedHere > 0 && (
                          <>
                            {step.droppedHere} vendor{step.droppedHere === 1 ? "" : "s"} reached the previous step but never got here.{" "}
                          </>
                        )}
                        {step.medianDaysFromRegistration !== null && (
                          <>Median {step.medianDaysFromRegistration} day{step.medianDaysFromRegistration === 1 ? "" : "s"} after registering.</>
                        )}
                      </span>
                      {i > 0 && step.stuckVendors.length > 0 && (
                        <button
                          className="font-medium text-emerald-700 hover:underline"
                          onClick={() => setExpandedStuck(expandedStuck === step.id ? null : step.id)}
                        >
                          {expandedStuck === step.id ? "Hide" : "View"} stuck vendors ({step.stuckVendors.length})
                        </button>
                      )}
                    </div>
                    {expandedStuck === step.id && step.stuckVendors.length > 0 && (
                      <div className="mt-2 overflow-x-auto rounded-lg border border-gray-100">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                              <th className="px-3 py-2">Store</th>
                              <th className="px-3 py-2">Email</th>
                              <th className="px-3 py-2">Registered</th>
                              <th className="px-3 py-2">Days ago</th>
                            </tr>
                          </thead>
                          <tbody>
                            {step.stuckVendors.map((v) => (
                              <tr key={v.vendorId} className="border-b border-gray-50 last:border-0">
                                <td className="px-3 py-2 font-medium text-gray-900">{v.storeName}</td>
                                <td className="px-3 py-2 text-gray-500">{v.email ?? "—"}</td>
                                <td className="px-3 py-2 text-gray-500">{formatDateTime(v.registeredAt)}</td>
                                <td className="px-3 py-2 text-gray-500">{v.daysSinceRegistration}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {data.unavailableStages.length > 0 && (
              <Card className="mb-6 border-amber-200 bg-amber-50/40">
                <h2 className="mb-1 text-base font-semibold text-gray-900">Requested stages not shown above</h2>
                <p className="mb-3 text-sm text-gray-500">
                  These were part of the requested funnel but the current data model can&apos;t support them
                  accurately — shown here honestly rather than estimated.
                </p>
                <ul className="space-y-2 text-sm">
                  {data.unavailableStages.map((s) => (
                    <li key={s.id}>
                      <span className="font-medium text-gray-900">{s.label}:</span>{" "}
                      <span className="text-gray-600">{s.reason}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <Card className="border-amber-200 bg-amber-50/40">
              <h2 className="mb-1 text-base font-semibold text-gray-900">Acquisition / campaign attribution</h2>
              <p className="text-sm text-gray-600">{data.attribution.reason}</p>
            </Card>
          </>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
