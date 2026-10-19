"use client";

import { useEffect, useState } from "react";
import { Button, Card, Icon } from "@/components/AdminUI";
import { peopleAPI } from "@/lib/services/people.api";

function randomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let out = "";
  for (let i = 0; i < 14; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/**
 * Admin-created demo/marketing buyer account (18 Oct 2026): public signup
 * is Turnstile-protected and can't be scripted, so this is the only way to
 * hand a client a working demo account without a human typing it into the
 * real signup form. Email is auto-generated unless overridden, password is
 * generated unless overridden, and the result stays on screen (not just a
 * toast) since this is the one time admin-web shows a plaintext password.
 */
export function DemoAccountDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("Demo Account");
  const [creditEuros, setCreditEuros] = useState("5000");
  const [withStore, setWithStore] = useState(true);
  const [storeName, setStoreName] = useState("Demo Store");
  const [withSupplier, setWithSupplier] = useState(true);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ email: string; password: string; walletBalanceMinor: number; currency: string; vendor: { storeName: string; storeSlug: string } | null; supplierAccount: { id: string } | null } | null>(null);

  useEffect(() => {
    if (open) {
      setEmail(`demo+${Date.now()}@ekiapp.com`);
      setPassword(randomPassword());
      setName("Demo Account");
      setCreditEuros("5000");
      setWithStore(true);
      setStoreName("Demo Store");
      setWithSupplier(true);
      setReason("");
      setError("");
      setResult(null);
      setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  const create = async () => {
    if (reason.trim().length < 5) { setError("Reason must be at least 5 characters"); return; }
    setLoading(true); setError("");
    try {
      const creditMinor = creditEuros ? Math.round(Number(creditEuros) * 100) : undefined;
      const res = await peopleAPI.createDemoAccount({
        email: email.trim().toLowerCase(), password, name: name.trim() || undefined, reason: reason.trim(), creditMinor,
        storeName: withStore ? storeName.trim() || "Demo Store" : undefined,
        supplier: withSupplier,
      });
      setResult({ email: res.email, password, walletBalanceMinor: res.walletBalanceMinor, currency: res.currency, vendor: res.vendor, supplierAccount: res.supplierAccount });
      onCreated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create demo account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Create demo account">
      <Card className="w-full max-w-lg">
        {result ? (
          <>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[#096B4A]">
                <Icon name="warning" className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-black text-[#101820]">Demo account ready</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Can buy normally — checkout draws from the wallet credit below, never Stripe.
                  {result.vendor ? " Can also add foodstuff — it publishes immediately, pre-verified." : ""}
                  {result.supplierAccount ? " Can also accept Community Buy campaigns and request supplier payouts — pre-approved, no Stripe KYC needed." : ""}
                  {" "}Save these now; the password is never shown again.
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm">
              <p><span className="font-black text-slate-500">Email:</span> {result.email}</p>
              <p><span className="font-black text-slate-500">Password:</span> {result.password}</p>
              <p><span className="font-black text-slate-500">Wallet balance:</span> {(result.walletBalanceMinor / 100).toFixed(2)} {result.currency}</p>
              {result.vendor ? <p><span className="font-black text-slate-500">Store:</span> {result.vendor.storeName} (/store/{result.vendor.storeSlug})</p> : null}
            </div>
            <div className="mt-5 flex gap-3">
              <Button className="flex-1" variant="primary" onClick={() => { void navigator.clipboard?.writeText(`${result.email} / ${result.password}`); }}>Copy email + password</Button>
              <Button className="flex-1" variant="ghost" onClick={onClose}>Done</Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[#096B4A]">
                <Icon name="warning" className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-black text-[#101820]">Create demo account</h3>
                <p className="mt-1 text-sm text-slate-600">A real buyer account, pre-verified and wallet-funded, for marketing/client demos. Never a real signup.</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Email</span>
                <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#096B4A]" />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Password</span>
                <input value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#096B4A]" />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Display name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#096B4A]" />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Wallet credit (EUR)</span>
                <input type="number" min="1" max="10000" value={creditEuros} onChange={(e) => setCreditEuros(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#096B4A]" />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={withStore} onChange={(e) => setWithStore(e.target.checked)} className="h-4 w-4 accent-[#096B4A]" />
                Also give it a vendor store (can add foodstuff — publishes immediately, pre-verified)
              </label>
              {withStore ? (
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Store name</span>
                  <input value={storeName} onChange={(e) => setStoreName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#096B4A]" />
                </label>
              ) : null}
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={withSupplier} onChange={(e) => setWithSupplier(e.target.checked)} className="h-4 w-4 accent-[#096B4A]" />
                Also give it Community Buy supplier capability (accept campaigns, request payouts — pre-approved, no Stripe KYC)
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Reason (recorded in the audit log)</span>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#096B4A]"
                  placeholder="e.g. Client demo for marketing walkthrough" />
              </label>
            </div>
            {error ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div> : null}
            <div className="mt-5 flex gap-3">
              <Button className="flex-1" variant="primary" disabled={loading} onClick={() => void create()}>{loading ? "Creating…" : "Create account"}</Button>
              <Button className="flex-1" variant="ghost" disabled={loading} onClick={onClose}>Cancel</Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
