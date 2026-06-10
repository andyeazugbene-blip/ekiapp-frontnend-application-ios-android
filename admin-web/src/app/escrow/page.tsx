"use client";

import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, PageHeader } from "@/components/AdminUI";

export default function ProviderControlsDisabledPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <PageHeader
            title="Provider controls disabled"
            subtitle="Diaspora launch is configured for Stripe-only checkout and web-only seller plans."
          />
          <Card>
            <h2 className="text-xl font-black">Launch mode</h2>
            <p className="mt-3 max-w-3xl text-slate-600">
              African provider controls are intentionally hidden for this release. Buyer checkout uses Stripe,
              seller plan billing happens on the website, and unsupported payment corridors stay unavailable
              until they are enabled by a future rollout.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="inline-flex h-11 items-center justify-center rounded-xl border border-[#096B4A] bg-[#096B4A] px-5 text-sm font-bold text-white hover:bg-[#07583d]" href="/orders">
                Review orders
              </Link>
              <Link className="inline-flex h-11 items-center justify-center rounded-xl border border-[#096B4A] bg-white px-5 text-sm font-bold text-[#096B4A] hover:bg-emerald-50" href="/subscription-plans">
                Manage seller plans
              </Link>
            </div>
          </Card>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
