"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import AdminLayout from "@/components/AdminLayout";
import { Button, Card, PageHeader } from "@/components/AdminUI";
import { Banner } from "@/components/AdminKit";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { twoFactorAPI, TwoFactorSetup } from "@/lib/services/security.api";

/** Mandatory 2FA enrolment (handbook 13): QR/secret, verify a code, show backup codes once. */
export default function SecuritySetupPage() {
  const router = useRouter();
  const { access, refresh } = usePermissions();
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);

  async function begin() {
    setError("");
    setBusy(true);
    try {
      const s = await twoFactorAPI.setup();
      setSetup(s);
      setQr(await QRCode.toDataURL(s.otpauthUrl, { margin: 1, width: 220 }));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Could not start setup.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (access && !access.twoFactor.enabled && !setup && !backupCodes) void begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access]);

  async function verify(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await twoFactorAPI.verify(code.trim());
      setBackupCodes(res.backupCodes);
      await refresh();
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ProtectedRoute allowUnenrolled>
      <AdminLayout>
        <div className="mx-auto max-w-2xl space-y-6">
          <PageHeader title="Set up two-factor authentication" subtitle="Required for all administrators before sensitive actions (refunds, payouts, roles, settings, broadcasts)." />
          {error ? <Banner tone="danger">{error}</Banner> : null}

          {backupCodes ? (
            <Card>
              <h2 className="text-xl font-black">Two-factor authentication is on</h2>
              <p className="mt-2 text-sm text-slate-600">
                Save these one-time backup codes somewhere safe. Each works once if you lose your authenticator. They will not be shown again.
              </p>
              <ul className="mt-4 grid grid-cols-2 gap-2 font-mono text-sm" aria-label="Backup codes">
                {backupCodes.map((c) => (
                  <li key={c} className="rounded-lg bg-slate-50 px-3 py-2">{c}</li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button variant="ghost" onClick={() => void navigator.clipboard?.writeText(backupCodes.join("\n"))}>Copy codes</Button>
              </div>
              <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="h-4 w-4 accent-[#096B4A]" />
                I have saved my backup codes
              </label>
              <Button className="mt-4" disabled={!saved} onClick={() => router.replace("/dashboard")}>Continue to dashboard</Button>
            </Card>
          ) : access?.twoFactor.enabled ? (
            <Banner tone="success" title="Already enabled">
              Two-factor authentication is already active on your account. Manage it under Settings, Security.
            </Banner>
          ) : (
            <Card>
              <ol className="list-decimal space-y-5 pl-5 text-sm text-slate-700">
                <li>
                  Scan this QR code with an authenticator app (Google Authenticator, 1Password, Authy).
                  <div className="mt-3 flex flex-wrap items-center gap-5">
                    {qr ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qr} alt="QR code for your authenticator app" width={220} height={220} className="rounded-xl border border-slate-200" />
                    ) : (
                      <div className="h-[220px] w-[220px] animate-pulse rounded-xl bg-slate-100" />
                    )}
                    {setup ? (
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500">Or enter this key manually</p>
                        <p className="mt-1 break-all font-mono text-sm font-bold">{setup.secret}</p>
                      </div>
                    ) : null}
                  </div>
                </li>
                <li>
                  Enter the 6-digit code it shows.
                  <form onSubmit={verify} className="mt-3 flex gap-3">
                    <label className="sr-only" htmlFor="totp">6-digit code</label>
                    <input id="totp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" className="h-11 w-40 rounded-xl border border-slate-300 px-3 text-lg tracking-widest outline-none focus:border-[#096B4A]" />
                    <Button disabled={busy || code.length !== 6 || !setup}>{busy ? "Checking..." : "Turn on 2FA"}</Button>
                  </form>
                </li>
              </ol>
            </Card>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
