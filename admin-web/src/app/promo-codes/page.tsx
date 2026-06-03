"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { promoCodesAPI } from "@/lib/services/promo-codes.api";
import { vendorsAPI } from "@/lib/services/vendors.api";
import { APIError } from "@/lib/api";
import { PromoCode, Vendor } from "@/types";

type PromoTypeOption = "PERCENTAGE" | "FIXED_AMOUNT";

const EMPTY_FORM = {
  vendorId: "",
  code: "",
  type: "PERCENTAGE" as PromoTypeOption,
  value: "10",
  minOrderAmount: "",
  maxUses: "",
  validFrom: "",
  validUntil: "",
};

export default function PromoCodesPage() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);

  const loadPromoCodes = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const items = await promoCodesAPI.getPromoCodes();
      setPromoCodes(items);
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.message);
      } else {
        setError("Failed to load promo codes");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPromoCodes();
  }, [loadPromoCodes]);

  useEffect(() => {
    let active = true;
    vendorsAPI
      .getVendors({ limit: 250 })
      .then((items) => {
        if (active) setVendors(items);
      })
      .catch(() => {
        if (active) setVendors([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const activeCount = useMemo(
    () => promoCodes.filter((promo) => promo.isActive).length,
    [promoCodes],
  );

  const handleCreatePromoCode = async () => {
    if (!form.code.trim()) {
      setError("Promo code is required");
      return;
    }
    if (!form.vendorId) {
      setError("Choose the store this promo code belongs to");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await promoCodesAPI.createPromoCode({
        vendorId: form.vendorId,
        code: form.code,
        type: form.type,
        value: Number(form.value),
        minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : undefined,
        maxUses: form.maxUses ? Number(form.maxUses) : undefined,
        validFrom: form.validFrom || undefined,
        validUntil: form.validUntil || undefined,
      });
      setForm(EMPTY_FORM);
      await loadPromoCodes();
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.message);
      } else {
        setError("Failed to create promo code");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePromoCode = async (promo: PromoCode) => {
    try {
      await promoCodesAPI.updatePromoCode(promo.id, { isActive: !promo.isActive });
      await loadPromoCodes();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to update promo code");
    }
  };

  const handleExtendPromoCode = async (promo: PromoCode) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 30);

    try {
      await promoCodesAPI.updatePromoCode(promo.id, {
        validUntil: targetDate.toISOString(),
      });
      await loadPromoCodes();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to extend promo code");
    }
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Promo Codes</h1>
              <p className="mt-1 text-sm text-gray-600">
                Create buyer offers, review usage, and keep promotions under control.
              </p>
            </div>
            <div className="rounded-lg bg-white px-4 py-3 shadow">
              <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Live offers</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">{activeCount}</div>
            </div>
          </div>

          {error ? (
            <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[420px,1fr]">
            <section className="rounded-lg bg-white p-6 shadow">
              <h2 className="text-lg font-semibold text-gray-900">Create promo code</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Store</label>
                  <select
                    value={form.vendorId}
                    onChange={(event) => setForm((current) => ({ ...current, vendorId: event.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                  >
                    <option value="">Choose a store</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.storeName} {vendor.storeSlug ? `(${vendor.storeSlug})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Code</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                    placeholder="WELCOME10"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Type</label>
                    <select
                      value={form.type}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, type: event.target.value as PromoTypeOption }))
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                    >
                      <option value="PERCENTAGE">Percentage</option>
                      <option value="FIXED_AMOUNT">Fixed amount</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      {form.type === "PERCENTAGE" ? "Discount %" : "Discount amount"}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={form.value}
                      onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Min order amount</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.minOrderAmount}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, minOrderAmount: event.target.value }))
                      }
                      placeholder="Optional"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Max uses</label>
                    <input
                      type="number"
                      min="1"
                      value={form.maxUses}
                      onChange={(event) => setForm((current) => ({ ...current, maxUses: event.target.value }))}
                      placeholder="Optional"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Valid from</label>
                    <input
                      type="datetime-local"
                      value={form.validFrom}
                      onChange={(event) => setForm((current) => ({ ...current, validFrom: event.target.value }))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Valid until</label>
                    <input
                      type="datetime-local"
                      value={form.validUntil}
                      onChange={(event) => setForm((current) => ({ ...current, validUntil: event.target.value }))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCreatePromoCode}
                  disabled={submitting}
                  className="w-full rounded-md bg-primary-600 px-4 py-2 text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Create promo code"}
                </button>
              </div>
            </section>

            <section className="rounded-lg bg-white p-6 shadow">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Offer history</h2>
                <button
                  type="button"
                  onClick={() => void loadPromoCodes()}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  Refresh
                </button>
              </div>

              {loading ? (
                <div className="py-12 text-center text-sm text-gray-500">Loading promo codes...</div>
              ) : promoCodes.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-500">No promo codes created yet.</div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Code</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Store</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Offer</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Usage</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Validity</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {promoCodes.map((promo) => (
                        <tr key={promo.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">{promo.code}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {promo.storeSlug || promo.vendorId || "Store required"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {promo.type === "PERCENTAGE" ? `${promo.value}% off` : `${(promo.value / 100).toFixed(2)} off`}
                            {promo.minOrderAmount ? (
                              <div className="text-xs text-gray-500">Min order {promo.minOrderAmount.toFixed(2)}</div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {promo.usedCount}
                            {promo.maxUses ? ` / ${promo.maxUses}` : ""}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            <div>{new Date(promo.validFrom).toLocaleString()}</div>
                            <div className="text-xs text-gray-500">
                              {promo.validUntil ? new Date(promo.validUntil).toLocaleString() : "No expiry"}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                promo.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {promo.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void handleTogglePromoCode(promo)}
                                className="font-medium text-primary-600 hover:text-primary-700"
                              >
                                {promo.isActive ? "Pause" : "Activate"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleExtendPromoCode(promo)}
                                className="font-medium text-gray-700 hover:text-gray-900"
                              >
                                Extend 30d
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
