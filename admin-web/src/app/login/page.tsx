"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, EkiMark, Icon } from "@/components/AdminUI";
import { useAuth } from "@/contexts/AuthContext";
import { APIError } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("admin@eki.com");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.status === 403 ? "Access denied. Admin role required." : err.message);
      } else {
        setError("Login failed. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#eef4f1] p-5 md:p-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-[1760px] overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)] lg:grid-cols-[1fr_1.08fr]">
        <section className="relative hidden overflow-hidden bg-gradient-to-br from-white via-[#f5fbf8] to-[#eaf5f0] p-16 lg:flex lg:flex-col">
          <EkiMark />
          <div className="my-auto max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-5 py-3 text-base font-bold text-[#096B4A]">
              <Icon name="verification" className="h-5 w-5" />
              Admin Portal
            </div>
            <h1 className="mt-10 text-6xl font-black leading-tight tracking-[-0.03em] text-[#101820]">
              Welcome back,<br />
              <span className="text-[#096B4A]">Admin</span>
            </h1>
            <p className="mt-8 max-w-lg text-2xl leading-9 text-slate-600">
              Sign in to access the Eki Marketplace Control Portal and manage your platform.
            </p>

            <div className="mt-14 space-y-8">
              <Feature icon="vendors" title="Manage users & vendors" text="Oversee vendors, customers and roles." />
              <Feature icon="analytics" title="Monitor performance" text="Track sales, listings and platform activity." />
              <Feature icon="verification" title="Secure & reliable" text="Enterprise-grade security for your data." />
            </div>
          </div>
          <div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-[#096B4A]" />
          <div className="pointer-events-none absolute bottom-10 left-20 h-52 w-52 rounded-full border border-emerald-200" />
        </section>

        <section className="flex items-center justify-center p-6 md:p-12">
          <div className="w-full max-w-[760px] rounded-[28px] border border-slate-200 bg-white px-8 py-10 shadow-[0_24px_70px_rgba(15,23,42,0.08)] md:px-14 md:py-16">
            <div className="text-center">
              <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-[28px] bg-emerald-50 text-[#096B4A]">
                <Icon name="user" className="h-16 w-16" />
              </div>
              <h2 className="mt-8 text-5xl font-black tracking-[-0.03em] text-[#101820]">Admin sign in</h2>
              <p className="mt-5 text-xl text-slate-500">Eki Marketplace Control Portal</p>
            </div>

            <form className="mt-12 space-y-7" onSubmit={handleSubmit}>
              {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">{error}</div> : null}

              <Field label="Email" icon="messages">
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full bg-transparent text-lg font-medium text-slate-700 outline-none"
                  placeholder="admin@eki.com"
                />
              </Field>

              <Field label="Password" icon="settings">
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full bg-transparent text-lg font-medium text-slate-700 outline-none"
                  placeholder="Enter your password"
                />
              </Field>

              <div className="flex items-center justify-between gap-4">
                <label className="flex items-center gap-3 text-base text-slate-700">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                    className="h-5 w-5 rounded border-slate-300 accent-[#096B4A]"
                  />
                  Remember me
                </label>
                <span className="text-base font-semibold text-[#096B4A]">Forgot password?</span>
              </div>

              <Button disabled={loading} className="h-16 w-full rounded-xl text-xl">
                {loading ? "Signing in..." : "Sign In"}
                <Icon name="arrow" className="h-5 w-5" />
              </Button>
            </form>

            <div className="mt-12 flex items-center gap-5 text-slate-400">
              <div className="h-px flex-1 bg-slate-200" />
              <span>or</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
            <p className="mt-8 text-center text-base text-slate-600">
              Need help? <span className="font-bold text-[#096B4A]">Contact support</span>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function Feature({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="flex items-center gap-5">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-[#096B4A]">
        <Icon name={icon} className="h-8 w-8" />
      </div>
      <div>
        <p className="text-xl font-black text-[#101820]">{title}</p>
        <p className="mt-1 text-lg text-slate-600">{text}</p>
      </div>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-3 block text-lg font-bold text-[#101820]">{label}</span>
      <span className="flex h-20 items-center gap-5 rounded-2xl border border-slate-300 px-6 transition focus-within:border-[#096B4A] focus-within:ring-4 focus-within:ring-emerald-50">
        <Icon name={icon} className="h-7 w-7 text-slate-400" />
        {children}
      </span>
    </label>
  );
}
