"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface NavItem {
  name: string;
  href: string;
}

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Orders", href: "/orders" },
  { name: "Vendors", href: "/vendors" },
  { name: "Users", href: "/users" },
  { name: "Products", href: "/products" },
  { name: "Verification", href: "/verification" },
  { name: "Refunds", href: "/refunds" },
  { name: "Disputes", href: "/disputes" },
  { name: "Promo Codes", href: "/promo-codes" },
  { name: "Plans", href: "/subscription-plans" },
  { name: "Payouts", href: "/payout-requests" },
  { name: "Logs", href: "/activity-logs" },
  { name: "Analytics", href: "/analytics" },
  { name: "Settings", href: "/settings" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [routePending, setRoutePending] = useState(false);
  const currentItem = navigation.find((item) => pathname === item.href || pathname?.startsWith(`${item.href}/`));

  useEffect(() => {
    setRoutePending(false);
    setSidebarOpen(false);
  }, [pathname]);

  const handleNavigate = (href: string) => {
    if (pathname === href) return;
    setRoutePending(true);
    router.push(href);
  };

  return (
    <div className="min-h-screen bg-[#f4f6f5] text-slate-900">
      <div
        className={`fixed left-0 right-0 top-0 z-50 h-1 origin-left bg-emerald-400 transition-all duration-300 ${
          routePending ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
        }`}
      />
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-20 bg-slate-950/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div
        className={`fixed inset-y-0 left-0 z-30 w-[272px] transform border-r border-white/10 bg-[#0b1f19] transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-sm font-black text-white">
                eki
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Admin</h1>
                <p className="text-xs font-medium text-emerald-100">Live control</p>
              </div>
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
                  onMouseEnter={() => router.prefetch(item.href)}
                  onFocus={() => router.prefetch(item.href)}
                  onClick={(event) => {
                    event.preventDefault();
                    handleNavigate(item.href);
                  }}
                  className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-white text-[#0b1f19] shadow-sm"
                      : "text-white hover:bg-white/10"
                  }`}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full transition-colors ${
                      isActive ? "bg-emerald-500" : "bg-white/35 group-hover:bg-emerald-300"
                    }`}
                  />
                  <span>{item.name}</span>
                  {routePending && isActive ? <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> : null}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-white/10 p-4">
            <div className="mb-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white">
              <div className="truncate font-semibold">{user?.name}</div>
              <div className="mt-1 truncate text-xs text-emerald-100">{user?.email}</div>
            </div>
            <button
              onClick={logout}
              className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="lg:pl-[272px]">
        <div className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200/80 bg-[#f4f6f5]/95 px-4 backdrop-blur md:px-6">
          <button
            onClick={() => setSidebarOpen((value) => !value)}
            className="rounded-xl p-2 text-slate-600 hover:bg-white hover:text-slate-900 lg:hidden"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="hidden min-w-0 flex-1 lg:block">
            <h2 className="truncate text-xl font-bold text-slate-900">{currentItem?.name ?? "Dashboard"}</h2>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden items-center space-x-2 rounded-full border border-emerald-100 bg-white px-3 py-2 sm:flex">
              <div className={`h-2.5 w-2.5 rounded-full ${routePending ? "animate-pulse bg-amber-400" : "bg-emerald-500"}`}></div>
              <span className="text-sm font-semibold text-slate-600">{routePending ? "Loading" : "Live"}</span>
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
