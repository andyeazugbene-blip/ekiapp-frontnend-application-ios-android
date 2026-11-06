"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, EmptyState, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import { formatDateTime } from "@/components/AdminKit";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError, apiClient } from "@/lib/api";

interface PartnerRow {
  code: string;
  signUps: number;
  stores: number;
  storesWithSale: number;
  firstSignUpAt: string | null;
  lastSignUpAt: string | null;
}

interface PartnerDetail {
  code: string;
  accounts: { userId: string; signedUpAt: string; country: string | null; store: string | null }[];
}

function PartnerCohorts() {
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [detail, setDetail] = useState<PartnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await apiClient.get<{ partners: PartnerRow[] }>("/admin/analytics/partner-cohorts", { bypassCache: true });
      setPartners(res.partners);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load partner sign-ups");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const open = async (code: string) => {
    try {
      setError("");
      setDetail(await apiClient.get<PartnerDetail>(`/admin/analytics/partner-cohorts/${encodeURIComponent(code)}`, { bypassCache: true }));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load this partner");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Partner sign-ups" subtitle="Accounts created with a partner code. Demo accounts aren't counted." />
      {loading ? <LoadingPanel label="Loading partner sign-ups..." /> : null}
      {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
      {!loading && !error && partners.length === 0 ? <EmptyState title="No partner sign-ups yet. Share a link like /invite/CODE?intent=sell, and anyone signing up with that code appears here." /> : null}
      {partners.length > 0 ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-bold">Partner code</th>
                  <th className="py-2 pr-4 font-bold">Sign-ups</th>
                  <th className="py-2 pr-4 font-bold">Stores</th>
                  <th className="py-2 pr-4 font-bold">Stores with a sale</th>
                  <th className="py-2 pr-4 font-bold">Latest sign-up</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {partners.map((p) => (
                  <tr key={p.code}>
                    <td className="py-3 pr-4 font-bold">{p.code}</td>
                    <td className="py-3 pr-4">{p.signUps}</td>
                    <td className="py-3 pr-4">{p.stores}</td>
                    <td className="py-3 pr-4">{p.storesWithSale}</td>
                    <td className="py-3 pr-4">{p.lastSignUpAt ? formatDateTime(p.lastSignUpAt) : "-"}</td>
                    <td className="py-3 text-right">
                      <button className="font-bold text-[#096B4A]" onClick={() => void open(p.code)}>View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
      {detail ? (
        <Card>
          <h2 className="text-xl font-black">{detail.code}</h2>
          <div className="mt-4 divide-y divide-slate-100 text-sm">
            {detail.accounts.map((a) => (
              <div key={a.userId} className="flex flex-wrap justify-between gap-3 py-3">
                <span className="font-mono text-xs text-slate-500">{a.userId}</span>
                <span>{a.store ?? "No store"}</span>
                <span className="text-slate-500">{a.country ?? "No country"}</span>
                <span className="text-slate-500">{formatDateTime(a.signedUpAt)}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

export default function PartnerCohortsPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <PartnerCohorts />
      </AdminLayout>
    </ProtectedRoute>
  );
}
