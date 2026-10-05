"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, Card, EkiMark } from "@/components/AdminUI";
import { Banner } from "@/components/AdminKit";
import { APIError, apiClient } from "@/lib/api";

function SetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await apiClient.post("/auth/reset-password", { token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Could not set the password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <EkiMark />
      <h1 className="mt-6 text-2xl font-black text-[#101820]">Set your admin password</h1>
      {!token ? (
        <div className="mt-4">
          <Banner tone="danger" title="Invalid link">
            This invitation link is missing its token. Ask a Super Administrator to send a new invitation.
          </Banner>
        </div>
      ) : done ? (
        <div className="mt-4 space-y-4">
          <Banner tone="success" title="Password set">
            You can now sign in. You will be asked to set up two-factor authentication on first sign-in.
          </Banner>
          <Link href="/login" className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#096B4A] text-sm font-bold text-white">
            Go to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-4">
          <p className="text-sm text-slate-600">Use at least 8 characters with an upper-case letter, a lower-case letter and a number.</p>
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <label className="block text-sm font-bold text-[#101820]">
            New password
            <input type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 font-normal outline-none focus:border-[#096B4A]" />
          </label>
          <label className="block text-sm font-bold text-[#101820]">
            Confirm password
            <input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 font-normal outline-none focus:border-[#096B4A]" />
          </label>
          <Button disabled={loading} className="h-11 w-full">
            {loading ? "Saving..." : "Set password"}
          </Button>
        </form>
      )}
    </Card>
  );
}

export default function SetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eef4f1] p-5">
      <Suspense fallback={null}>
        <SetPasswordForm />
      </Suspense>
    </main>
  );
}
