"use client";

import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { subscriptionPlansAPI } from "@/lib/services/subscription-plans.api";
import { AdminSubscriptionPlan } from "@/types";

const EMPTY_PLAN = (): AdminSubscriptionPlan => ({
  id: "",
  plan: "",
  slug: "",
  name: "New plan",
  description: "",
  monthlyPriceCents: 0,
  platformFeeBps: 1200,
  withdrawalFeeBps: 0,
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
  isDefault: false,
  displayOrder: 0,
  commissionTiers: [{ minSubtotalCents: 0, platformFeeBps: 1200, isActive: true, displayOrder: 0 }],
});

export default function SubscriptionPlansPage() {
  const [plans, setPlans] = useState<AdminSubscriptionPlan[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [draft, setDraft] = useState<AdminSubscriptionPlan>(EMPTY_PLAN());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const match = plans.find((plan) => plan.id === selectedId);
    if (match) {
      setDraft(match);
    }
  }, [plans, selectedId]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const nextPlans = await subscriptionPlansAPI.getPlans();
      setPlans(nextPlans);
      const first = nextPlans[0];
      if (first) {
        setSelectedId(first.id);
        setDraft(first);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load plans.");
    } finally {
      setLoading(false);
    }
  }

  function newPlan() {
    setSelectedId("");
    setDraft(EMPTY_PLAN());
    setMessage("");
    setError("");
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

  async function deletePlan() {
    if (!draft.id) return;
    if (!window.confirm(`Delete plan "${draft.name}"? Vendors on this plan stay on it until reassigned.`)) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await subscriptionPlansAPI.deletePlan(draft.id);
      setPlans((current) => current.filter((plan) => plan.id !== draft.id));
      setMessage(`${draft.name} deleted.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete plan.");
    } finally {
      setSaving(false);
    }
  }

  async function savePlan() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = await subscriptionPlansAPI.savePlan(draft);
      setPlans((current) => {
        const without = current.filter((plan) => plan.id !== saved.id);
        const next = saved.isDefault ? without.map((plan) => ({ ...plan, isDefault: false })) : without;
        return [...next, saved].sort((a, b) => a.displayOrder - b.displayOrder);
      });
      setSelectedId(saved.id);
      setDraft(saved);
      setMessage(`${saved.name} saved.`);
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
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Plans</h2>
                <button type="button" onClick={newPlan} className="text-xs font-semibold text-gray-900 hover:underline">
                  + New plan
                </button>
              </div>
              <div className="mt-4 space-y-2">
                {loading ? (
                  <p className="text-sm text-gray-500">Loading plans…</p>
                ) : (
                  plans.map((plan) => {
                    const active = selectedId === plan.id;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(plan.id);
                          setDraft(plan);
                        }}
                        className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                          active ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-900 hover:border-gray-400"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{plan.name}</span>
                          <span className={`text-xs ${active ? "text-gray-200" : "text-gray-500"}`}>
                            {plan.isDefault ? "Default" : plan.isActive ? "Active" : "Hidden"}
                          </span>
                        </div>
                        <p className={`mt-1 text-xs ${active ? "text-gray-300" : "text-gray-500"}`}>{plan.slug}</p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Plan code (legacy, optional)" value={draft.plan} disabled={Boolean(draft.id)} onChange={(value) => setDraft((current) => ({ ...current, plan: value.toUpperCase() }))} />
                <Field label="Slug" value={draft.slug} onChange={(value) => setDraft((current) => ({ ...current, slug: value.toLowerCase() }))} />
                <Field label="Display name" value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} />
                <Field label="Currency" value={draft.currency} onChange={(value) => setDraft((current) => ({ ...current, currency: value.toUpperCase() }))} />
                <Field label="Monthly price (cents)" value={String(draft.monthlyPriceCents)} onChange={(value) => setDraft((current) => ({ ...current, monthlyPriceCents: Number(value || 0) }))} type="number" />
                <Field label="Platform fee (basis points)" value={String(draft.platformFeeBps)} onChange={(value) => setDraft((current) => ({ ...current, platformFeeBps: Number(value || 0) }))} type="number" />
                <Field label="Withdrawal fee (basis points)" value={String(draft.withdrawalFeeBps)} onChange={(value) => setDraft((current) => ({ ...current, withdrawalFeeBps: Number(value || 0) }))} type="number" />
                <Field label="Display order" value={String(draft.displayOrder)} onChange={(value) => setDraft((current) => ({ ...current, displayOrder: Number(value || 0) }))} type="number" />
                <Field label="Max products" value={String(draft.maxProducts)} onChange={(value) => setDraft((current) => ({ ...current, maxProducts: Number(value || 0) }))} type="number" />
                <Field label="Max images / product" value={String(draft.maxImagesPerProduct)} onChange={(value) => setDraft((current) => ({ ...current, maxImagesPerProduct: Number(value || 0) }))} type="number" />
              </div>

              <p className="mt-3 text-xs text-gray-500">
                Basis points example: <code>1000</code> = 10.00%, <code>650</code> = 6.50%.
              </p>

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
                <label className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                  <div>
                    <span className="text-sm font-medium text-gray-800">Default plan for new vendors</span>
                    <p className="text-xs text-gray-500">Only one plan can be default. Saving this unsets it on all others.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={draft.isDefault}
                    onChange={(event) => setDraft((current) => ({ ...current, isDefault: event.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                </label>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Commission tiers</h3>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        commissionTiers: [
                          ...current.commissionTiers,
                          { minSubtotalCents: 0, platformFeeBps: current.platformFeeBps, isActive: true, displayOrder: current.commissionTiers.length },
                        ],
                      }))
                    }
                    className="text-xs font-semibold text-gray-900 hover:underline"
                  >
                    + Add tier
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">At least one active tier must start at 0 (min subtotal cents).</p>
                <div className="mt-3 space-y-3">
                  {draft.commissionTiers.map((tier, index) => (
                    <div key={tier.id ?? index} className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 p-3 md:grid-cols-5">
                      <Field
                        label="Min subtotal (cents)"
                        value={String(tier.minSubtotalCents)}
                        type="number"
                        onChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            commissionTiers: current.commissionTiers.map((t, i) => (i === index ? { ...t, minSubtotalCents: Number(value || 0) } : t)),
                          }))
                        }
                      />
                      <Field
                        label="Max subtotal (cents, optional)"
                        value={tier.maxSubtotalCents == null ? "" : String(tier.maxSubtotalCents)}
                        type="number"
                        onChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            commissionTiers: current.commissionTiers.map((t, i) => (i === index ? { ...t, maxSubtotalCents: value === "" ? null : Number(value) } : t)),
                          }))
                        }
                      />
                      <Field
                        label="Fee (basis points)"
                        value={String(tier.platformFeeBps)}
                        type="number"
                        onChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            commissionTiers: current.commissionTiers.map((t, i) => (i === index ? { ...t, platformFeeBps: Number(value || 0) } : t)),
                          }))
                        }
                      />
                      <Field
                        label="Label (optional)"
                        value={tier.label ?? ""}
                        onChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            commissionTiers: current.commissionTiers.map((t, i) => (i === index ? { ...t, label: value } : t)),
                          }))
                        }
                      />
                      <div className="flex items-end justify-between gap-2">
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={tier.isActive}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                commissionTiers: current.commissionTiers.map((t, i) => (i === index ? { ...t, isActive: event.target.checked } : t)),
                              }))
                            }
                            className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                          />
                          Active
                        </label>
                        {draft.commissionTiers.length > 1 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                commissionTiers: current.commissionTiers.filter((_, i) => i !== index),
                              }))
                            }
                            className="text-xs font-semibold text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                {draft.id ? (
                  <button
                    type="button"
                    onClick={deletePlan}
                    disabled={saving}
                    className="rounded-lg border border-red-300 px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Delete plan
                  </button>
                ) : null}
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
