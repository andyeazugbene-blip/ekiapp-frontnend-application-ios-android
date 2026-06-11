"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { EkiMark, Icon } from "@/components/AdminUI";
import { useAuth } from "@/contexts/AuthContext";
import { CurrencyProvider, useCurrency } from "@/contexts/CurrencyContext";

interface NavItem {
  name: string;
  href: string;
  icon: string;
}

const navigation: NavItem[] = [
  { name: "Overview", href: "/dashboard", icon: "overview" },
  { name: "Vendors", href: "/vendors", icon: "vendors" },
  { name: "Orders", href: "/orders", icon: "orders" },
  { name: "Products", href: "/products", icon: "products" },
  { name: "Users", href: "/users", icon: "messages" },
  { name: "Reviews", href: "/reviews", icon: "orders" },
  { name: "Disputes", href: "/disputes", icon: "disputes" },
  { name: "Verifications", href: "/verification", icon: "verification" },
  { name: "Uploads", href: "/uploads", icon: "products" },
  { name: "Payments", href: "/payments", icon: "vendors" },
  { name: "Wallet Txns", href: "/wallet-transactions", icon: "vendors" },
  { name: "Communication", href: "/communication", icon: "communication" },
  { name: "Send Offer", href: "/send-offer", icon: "communication" },
  { name: "Promo Codes", href: "/promo-codes", icon: "orders" },
  { name: "Payout Requests", href: "/payout-requests", icon: "vendors" },
  { name: "Refunds", href: "/refunds", icon: "vendors" },
  { name: "Escrow", href: "/escrow", icon: "disputes" },
  { name: "Delivery Zones", href: "/delivery-zones", icon: "vendors" },
  { name: "Admin Roles", href: "/roles", icon: "settings" },
  { name: "Seller Plans", href: "/subscription-plans", icon: "orders" },
  { name: "Activity Logs", href: "/activity-logs", icon: "analytics" },
  { name: "Analytics", href: "/analytics", icon: "analytics" },
  { name: "Settings", href: "/settings", icon: "settings" },
];

function SidebarCurrency() {
  const { selectedCurrency, setSelectedCurrency, currencyOptions } = useCurrency();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative border-t border-slate-200 px-4 py-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-emerald-50 hover:text-[#096B4A] transition"
      >
        <span>Currency: {selectedCurrency}</span>
        <svg className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute bottom-full left-4 right-4 mb-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          {currencyOptions.map((code) => (
            <button
              key={code}
              onClick={() => { setSelectedCurrency(code); setOpen(false); }}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
                code === selectedCurrency ? "bg-emerald-50 text-[#096B4A]" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {code}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [routePending, setRoutePending] = useState(false);

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
    <CurrencyProvider>
      <div className="min-h-screen bg-[#f8faf9] text-[#101820]">
        <div
          className={`fixed left-0 right-0 top-0 z-[60] h-1 origin-left bg-[#096B4A] transition-all duration-300 ${
            routePending ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
          }`}
        />

        {sidebarOpen ? (
          <button
            aria-label="Close navigation"
            className="fixed inset-0 z-30 bg-slate-950/25 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-40 w-[292px] transform border-r border-slate-200 bg-white transition-transform duration-300 lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="px-10 py-10">
              <EkiMark />
            </div>

            <nav className="flex-1 space-y-2 overflow-y-auto px-4">
              {navigation.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch
                    onMouseEnter={() => router.prefetch(item.href)}
                    onFocus={() => router.prefetch(item.href)}
                    onClick={(event) => {
                      event.preventDefault();
                      handleNavigate(item.href);
                    }}
                    className={`group relative flex h-14 items-center gap-4 rounded-xl px-6 text-[15px] font-semibold transition ${
                      isActive ? "bg-emerald-50 text-[#096B4A]" : "text-slate-700 hover:bg-slate-50 hover:text-[#096B4A]"
                    }`}
                  >
                    {isActive ? <span className="absolute left-0 h-11 w-1 rounded-r-full bg-[#096B4A]" /> : null}
                    <Icon name={item.icon} className="h-5 w-5" />
                    <span>{item.name}</span>
                    {routePending && isActive ? <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-[#096B4A]" /> : null}
                  </Link>
                );
              })}
            </nav>

            <SidebarCurrency />

            <div className="border-t border-slate-200 p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-200 text-lg font-bold text-slate-700">
                  {user?.name?.charAt(0)?.toUpperCase() || "A"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold text-[#101820]">{user?.name || "Admin"}</p>
                  <p className="truncate text-sm text-slate-500">{user?.email || "admin@eki.com"}</p>
                </div>
                <button onClick={logout} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-red-600" title="Sign out">
                  <Icon name="arrow" className="h-4 w-4 rotate-180" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        <div className="lg:pl-[292px]">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden">
            <button
              onClick={() => setSidebarOpen((value) => !value)}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700"
              aria-label="Open navigation"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-sm font-bold text-[#096B4A]">{routePending ? "Loading" : "Live"}</span>
          </header>

          <main className="mx-auto min-h-screen max-w-[1480px] px-5 py-8 md:px-10 lg:px-12">{children}</main>
        </div>
      </div>
    </CurrencyProvider>
  );
}
