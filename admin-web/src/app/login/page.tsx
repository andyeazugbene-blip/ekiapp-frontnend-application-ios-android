"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { APIError } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof APIError) {
        if (err.status === 403) {
          setError("Access denied. Admin role required.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Login failed. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#edf2ef] px-4 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-stretch gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden rounded-[32px] bg-gradient-to-br from-[#103b31] via-[#114538] to-[#16352d] p-10 text-white shadow-[0_24px_80px_rgba(8,38,30,0.24)] lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-100/70">Culinary Tales</p>
            <h1 className="mt-4 max-w-lg text-4xl font-bold leading-tight">Classic control, modern operations.</h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-emerald-50/72">
              Review vendors, inspect orders, monitor payouts, and keep the marketplace moving without digging through clutter.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FeatureCard title="Fast review" body="Approvals, suspensions, and order checks designed for quick daily work." />
            <FeatureCard title="Role-aware access" body="Strict admin-only access with clear auth flows and controlled session handling." />
            <FeatureCard title="Operational visibility" body="Orders, vendors, users, payouts, and logs in one connected control surface." />
            <FeatureCard title="Stable dev flow" body="The admin workspace now self-cleans stale Next chunks before local dev starts." />
          </div>
        </section>

        <div className="flex items-center justify-center">
          <div className="w-full max-w-md rounded-[32px] border border-white/80 bg-white p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
            <div>
              <div className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Admin only
              </div>
              <h2 className="mt-4 text-3xl font-bold text-slate-900">Sign in to Admin Control</h2>
              <p className="mt-2 text-sm text-slate-500">Culinary Tales marketplace oversight</p>
            </div>

            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-2 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    placeholder="admin@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-2 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
              <p className="font-semibold text-slate-700">Admin access only</p>
              <p className="mt-1 break-all">API: {process.env.NEXT_PUBLIC_API_URL}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-emerald-50/68">{body}</p>
    </div>
  );
}
