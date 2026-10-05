"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, LoadingPanel } from "@/components/AdminUI";
import { Banner, KeyValue, useConfirm } from "@/components/AdminKit";
import { IDLE_TIMEOUT_MINUTES } from "@/components/IdleSignOut";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { APIError } from "@/lib/api";
import { sessionsAPI, twoFactorAPI } from "@/lib/services/security.api";

export default function SecurityTab() {
  const { access, loading, refresh } = usePermissions();
  const confirm = useConfirm();
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [totp, setTotp] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading || !access) return <LoadingPanel label="Loading security status..." />;
  const tf = access.twoFactor;

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setNotice({ tone: "danger", text: err instanceof APIError ? err.message : `${label} failed.` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {notice ? <Banner tone={notice.tone}>{notice.text}</Banner> : null}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Two-factor authentication</h2>
            <p className="mt-1 text-sm text-slate-500">
              {tf.enforced
                ? "Mandatory for every administrator. Sensitive actions are refused until it is set up."
                : "Enforcement is switched off in this environment (ADMIN_2FA_ENFORCE); it is on by default in production."}
            </p>
          </div>
          {tf.enabled ? <Badge tone="green">Enabled</Badge> : <Badge tone="amber">Not set up</Badge>}
        </div>

        {!tf.enabled ? (
          <Link href="/security/setup" className="mt-5 inline-flex h-11 items-center rounded-xl bg-[#096B4A] px-5 text-sm font-bold text-white hover:bg-[#075a3e]">
            Set up two-factor authentication
          </Link>
        ) : (
          <div className="mt-5 space-y-4">
            <label className="block max-w-xs text-sm font-bold">
              Current 6-digit code (needed to change 2FA)
              <input value={totp} onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={6} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 tracking-widest outline-none focus:border-[#096B4A]" placeholder="123456" />
            </label>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="ghost"
                disabled={busy || totp.length !== 6}
                onClick={() =>
                  void run("Regenerating backup codes", async () => {
                    const res = await twoFactorAPI.regenerateBackupCodes(totp);
                    setCodes(res.backupCodes);
                    setTotp("");
                  })
                }
              >
                Regenerate backup codes
              </Button>
              {!tf.enforced ? (
                <Button
                  variant="danger"
                  disabled={busy || totp.length !== 6}
                  onClick={() =>
                    void run("Disabling 2FA", async () => {
                      await twoFactorAPI.disable(totp);
                      setTotp("");
                      await refresh();
                      setNotice({ tone: "success", text: "Two-factor authentication disabled." });
                    })
                  }
                >
                  Turn off 2FA
                </Button>
              ) : (
                <p className="self-center text-xs text-slate-500">2FA cannot be turned off while enforcement is on.</p>
              )}
            </div>
            {codes ? (
              <div>
                <p className="text-sm font-bold">New backup codes (shown once, previous codes no longer work)</p>
                <ul className="mt-2 grid max-w-md grid-cols-2 gap-2 font-mono text-sm">
                  {codes.map((c) => <li key={c} className="rounded-lg bg-slate-50 px-3 py-2">{c}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-xl font-black">Sessions</h2>
        <div className="mt-4">
          <KeyValue
            items={[
              { label: "Idle sign-out", value: `${IDLE_TIMEOUT_MINUTES} minutes without activity in this browser, with a one-minute warning` },
              { label: "Your roles", value: access.roles.length ? access.roles.map((r) => r.name).join(", ") : "None" },
            ]}
          />
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            variant="danger"
            disabled={busy}
            onClick={() =>
              confirm.ask(
                { title: "Sign out all other sessions?", description: "Every other browser or device signed in as you is signed out immediately. This browser stays signed in.", confirmLabel: "Sign out others" },
                async (reason) => {
                  await sessionsAPI.revokeOthers(reason);
                  setNotice({ tone: "success", text: "All other sessions were signed out." });
                },
              )
            }
          >
            Sign out all other sessions
          </Button>
        </div>
        <p className="mt-3 max-w-2xl text-xs text-slate-500">
          Limits: sessions are stateless tokens, so there is no per-device list and no device-level revoke. Signing out others invalidates every earlier token for your account at once. The idle timer only runs in the browser.
        </p>
      </Card>
      {confirm.dialog}
    </div>
  );
}
