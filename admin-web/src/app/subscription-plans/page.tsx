"use client";

import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { subscriptionPlansAPI } from "@/lib/services/subscription-plans.api";
import { AdminSubscriptionPlan } from "@/types";

const PLAN_OPTIONS = ["FREE", "GROWTH", "PRO"] as const;

const EMPTY_PLAN = (): AdminSubscriptionPlan => ({
  id: "",
  plan: "FREE",
  slug: "free",
  name: "Free",
  description: "",
  monthlyPriceCents: 0,
  currency: "GBP",
  maxProducts: 10,
  maxImagesPerProduct: 3,
  maxOrders: null,
  analytics: false,
  prioritySupport: false,
  flashSales: false,
  bundles: false,
  discounts: false,
  marketingTools: false,
  canReceiveOrders: true,
  isActive: true,
  displayOrder: 0,
});

export default function SubscriptionPlansPage() {
  const [plans, setPlans] = useState<AdminSubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>("FREE");
  const [draft, setDraft] = useState<AdminSubscriptionPlan>(EMPTY_PLAN());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const match = plans.find((plan) => plan.plan === selectedPlan);
    if (match) {
      setDraft(match);
    }
  }, [plans, selectedPlan]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const nextPlans = await subscriptionPlansAPI.getPlans();
      setPlans(nextPlans);
      const first = nextPlans.find((plan) => PLAN_OPTIONS.includes(plan.plan as any));
      if (first) {
        setSelectedPlan(first.plan);
        setDraft(first);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load plans.");
    } finally {
      setLoading(false);
    }
  }

  const featureRows = useMemo(
    () => [
      { key: "analytics", label: "Analytics" },
      { key: "marketingTools", label: "Marketing tools" },
      { key: "discounts", label: "Coupons" },
      { key: "bundles", label: "Bundles" },
      { key: "flashSales", label: "Flash sales" },
      { key: "prioritySupport", label: "Priority support" },
      { key: "canReceiveOrders", label: "Receive orders" },
    ],
    [],
  );

  async function savePlan() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = await subscriptionPlansAPI.savePlan(draft);
      setPlans((current) => {
        const without = current.filter((plan) => plan.plan !== saved.plan);
        return [...without, saved].sort((a, b) => a.displayOrder - b.displayOrder);
      });
      setDraft(saved);
      setMessage(`${saved.name} updated.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save plan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Subscription Plans</h1>
            <p className="mt-1 text-sm text-gray-600">
              Control the website subscription catalog. The mobile app only reads plan status and entitlements.
            </p>
          </div>

          {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {message ? <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div> : null}

          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">Plans</h2>
              <div className="mt-4 space-y-2">
                {loading ? (
                  <p className="text-sm text-gray-500">Loading plans…</p>
                ) : (
                  PLAN_OPTIONS.map((planCode) => {
                    const plan = plans.find((item) => item.plan === planCode);
                    const active = selectedPlan === planCode;
                    return (
                      <button
                        key={planCode}
                        type="button"
                        onClick={() => {
                          setSelectedPlan(planCode);
                          setDraft(plan ?? { ...EMPTY_PLAN(), plan: planCode, slug: planCode.toLowerCase(), name: planCode[0] + planCode.slice(1).toLowerCase() });
                        }}
                        className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                          active ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-900 hover:border-gray-400"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{plan?.name ?? planCode}</span>
                          <span className={`text-xs ${active ? "text-gray-200" : "text-gray-500"}`}>
                            {plan?.isActive ? "Active" : "Hidden"}
                          </span>
                        </div>
                        <p className={`mt-1 text-xs ${active ? "text-gray-300" : "text-gray-500"}`}>
                          {plan?.slug ?? planCode.toLowerCase()}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Plan code" value={draft.plan} disabled />
                <Field label="Slug" value={draft.slug} onChange={(value) => setDraft((current) => ({ ...current, slug: value.toLowerCase() }))} />
                <Field label="Display name" value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} />
                <Field label="Currency" value={draft.currency} onChange={(value) => setDraft((current) => ({ ...current, currency: value.toUpperCase() }))} />
                <Field label="Monthly price (cents)" value={String(draft.monthlyPriceCents)} onChange={(value) => setDraft((current) => ({ ...current, monthlyPriceCents: Number(value || 0) }))} type="number" />
                <Field label="Display order" value={String(draft.displayOrder)} onChange={(value) => setDraft((current) => ({ ...current, displayOrder: Number(value || 0) }))} type="number" />
                <Field label="Max products" value={String(draft.maxProducts)} onChange={(value) => setDraft((current) => ({ ...current, maxProducts: Number(value || 0) }))} type="number" />
                <Field label="Max images / product" value={String(draft.maxImagesPerProduct)} onChange={(value) => setDraft((current) => ({ ...current, maxImagesPerProduct: Number(value || 0) }))} type="number" />
              </div>

              <label className="mt-4 block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={draft.description ?? ""}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                rows={3}
              />

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {featureRows.map((feature) => (
                  <label key={feature.key} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                    <span className="text-sm font-medium text-gray-800">{feature.label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean((draft as any)[feature.key])}
                      onChange={(event) => setDraft((current) => ({ ...current, [feature.key]: event.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                    />
                  </label>
                ))}
                <label className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                  <span className="text-sm font-medium text-gray-800">Visible on website</span>
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                </label>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={savePlan}
                  disabled={saving}
                  className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save plan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  type?: "text" | "number";
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none disabled:bg-gray-100"
      />
    </label>
  );
}
