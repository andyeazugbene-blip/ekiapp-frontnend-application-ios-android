"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface NavItem {
  name: string;
  href: string;
  shortLabel: string;
}

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", shortLabel: "Dash" },
  { name: "Orders", href: "/orders", shortLabel: "Orders" },
  { name: "Vendors", href: "/vendors", shortLabel: "Vendors" },
  { name: "Users", href: "/users", shortLabel: "Users" },
  { name: "Products", href: "/products", shortLabel: "Products" },
  { name: "Verification", href: "/verification", shortLabel: "Verify" },
  { name: "Refunds", href: "/refunds", shortLabel: "Refund" },
  { name: "Disputes", href: "/disputes", shortLabel: "Dispute" },
  { name: "Promo Codes", href: "/promo-codes", shortLabel: "Promo" },
  { name: "Plans", href: "/subscription-plans", shortLabel: "Plans" },
  { name: "Payouts", href: "/payout-requests", shortLabel: "Payout" },
  { name: "Logs", href: "/activity-logs", shortLabel: "Logs" },
  { name: "Analytics", href: "/analytics", shortLabel: "Stats" },
  { name: "Settings", href: "/settings", shortLabel: "Config" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentItem = navigation.find((item) => pathname === item.href || pathname?.startsWith(`${item.href}/`));

  return (
    <div className="min-h-screen bg-[#f4f6f5] text-slate-900">
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-20 bg-slate-950/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div
        className={`fixed inset-y-0 left-0 z-30 w-[288px] transform border-r border-white/10 bg-[#10251f] transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 px-5 py-5">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-100/60">Culinary Tales</p>
              <h1 className="mt-2 text-xl font-bold text-white">Admin Control</h1>
              <p className="mt-1 text-sm text-emerald-50/60">Classic operations, modern visibility.</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  prefetch
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all ${
                    isActive
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-emerald-50/76 hover:bg-white/8 hover:text-white"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span
                    className={`inline-flex min-w-[3rem] rounded-xl px-2 py-1 text-center text-[11px] font-semibold uppercase tracking-wide ${
                      isActive ? "bg-emerald-50 text-emerald-700" : "bg-white/10 text-emerald-50/70"
                    }`}
                  >
                    {item.shortLabel}
                  </span>
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-white/10 p-4">
            <div className="mb-3 rounded-2xl bg-white/5 px-4 py-3 text-sm text-emerald-50/70">
              <div className="font-medium text-white">{user?.name}</div>
              <div className="mt-1 text-xs">{user?.email}</div>
            </div>
            <button
              onClick={logout}
              className="w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/16"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="lg:pl-[288px]">
        <div className="sticky top-0 z-10 flex h-20 items-center justify-between border-b border-slate-200/80 bg-[#f4f6f5]/92 px-4 backdrop-blur md:px-6">
          <button
            onClick={() => setSidebarOpen((value) => !value)}
            className="rounded-2xl p-2 text-slate-600 hover:bg-white hover:text-slate-900 lg:hidden"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="hidden min-w-0 flex-1 lg:block">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Admin panel</p>
            <h2 className="truncate text-2xl font-bold text-slate-900">{currentItem?.name ?? "Dashboard"}</h2>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden items-center space-x-2 rounded-full border border-emerald-100 bg-white px-3 py-2 sm:flex">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500"></div>
              <span className="text-sm font-medium text-slate-600">API Connected</span>
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
              <span className="font-medium">{user?.role}</span>
            </div>
          </div>
        </div>

        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
