"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { CurrencyProvider, useCurrency } from "@/contexts/CurrencyContext";

interface NavItem {
  name: string;
  href: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    label: "OPERATE",
    items: [
      { name: "Overview", href: "/dashboard" },
      { name: "Vendors", href: "/vendors" },
      { name: "Orders", href: "/orders" },
      { name: "Products", href: "/products" },
      { name: "Users", href: "/users" },
      { name: "Reviews", href: "/reviews" },
    ],
  },
  {
    label: "TRUST & RISK",
    items: [
      { name: "Verifications", href: "/verification" },
      { name: "Uploads", href: "/uploads" },
      { name: "Disputes", href: "/disputes" },
      { name: "Activity Logs", href: "/activity-logs" },
    ],
  },
  {
    label: "MONEY",
    items: [
      { name: "Payments", href: "/payments" },
      { name: "Wallet Txns", href: "/wallet-transactions" },
      { name: "Escrow", href: "/escrow" },
      { name: "Payout Requests", href: "/payout-requests" },
      { name: "Refunds", href: "/refunds" },
      { name: "Ledger Reconciliation", href: "/ledger" },
      { name: "Seller Plans", href: "/subscription-plans" },
    ],
  },
  {
    label: "GROWTH",
    items: [
      { name: "Send Offer", href: "/send-offer" },
      { name: "Promo Codes", href: "/promo-codes" },
      { name: "Campaigns", href: "/campaigns" },
      { name: "Communications", href: "/communications" },
      { name: "Automation", href: "/automation" },
    ],
  },
  {
    label: "COMMUNITY BUY",
    items: [
      { name: "Campaign Review", href: "/community-campaigns" },
      { name: "Verification", href: "/community-verification" },
      { name: "Refunds", href: "/community-refunds" },
      { name: "Financial Ledger", href: "/community-ledger" },
      { name: "Support Cases", href: "/community-support-cases" },
      { name: "Market Controls", href: "/community-markets" },
      { name: "Subscription Exceptions", href: "/subscription-exceptions" },
    ],
  },
];

const allNavItems = sections.flatMap((s) => s.items);

function SidebarCurrency() {
  const { selectedCurrency, setSelectedCurrency, currencyOptions } = useCurrency();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative px-5 py-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg bg-white/10 px-3 py-2 text-[13px] font-semibold text-white/80 hover:bg-white/15 transition"
      >
        <span>Currency: {selectedCurrency}</span>
        <svg className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute bottom-full left-5 right-5 mb-1 rounded-xl border border-white/10 bg-[#0a3d2a] p-2 shadow-lg">
          {currencyOptions.map((code) => (
            <button
              key={code}
              onClick={() => { setSelectedCurrency(code); setOpen(false); }}
              className={`block w-full rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition ${
                code === selectedCurrency ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
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
          className={`fixed left-0 right-0 top-0 z-[60] h-1 origin-left bg-emerald-400 transition-all duration-300 ${
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
          className={`fixed inset-y-0 left-0 z-40 w-[220px] transform transition-transform duration-300 lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{ background: "linear-gradient(180deg, #0d4a34 0%, #0a3527 40%, #072a1e 100%)" }}
        >
          <div className="flex h-full flex-col">
            {/* Logo */}
            <div className="flex items-center gap-2.5 px-5 py-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500">
                <svg viewBox="0 0 20 20" className="h-4.5 w-4.5 text-white" fill="currentColor">
                  <path d="M10 2L3 7v11h5v-6h4v6h5V7l-7-5z" />
                </svg>
              </div>
              <span className="text-[15px] font-bold text-white tracking-tight">Eki Admin</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 pb-2 sidebar-scroll">
              {sections.map((section) => (
                <div key={section.label} className="mb-3">
                  <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-400/90">
                    {section.label}
                  </p>
                  {section.items.map((item) => {
                    const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        prefetch
                        onMouseEnter={() => router.prefetch(item.href)}
                        onClick={(event) => {
                          event.preventDefault();
                          handleNavigate(item.href);
                        }}
                        className={`group flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] font-medium transition ${
                          isActive
                            ? "bg-white/15 text-white font-semibold"
                            : "text-white/65 hover:bg-white/8 hover:text-white/90"
                        }`}
                      >
                        <span className={`h-[5px] w-[5px] rounded-full ${isActive ? "bg-white" : "bg-white/30"}`} />
                        <span>{item.name}</span>
                        {routePending && isActive ? <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> : null}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>

            <SidebarCurrency />

            {/* Bottom section */}
            <div className="border-t border-white/10 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-[12px] font-bold text-white">
                  {user?.name?.charAt(0)?.toUpperCase() || "A"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-white">{user?.name || "Admin"}</p>
                  <p className="truncate text-[10px] text-white/50">{user?.email || "admin@eki.com"}</p>
                </div>
                <button onClick={logout} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-red-300 transition" title="Sign out">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </aside>

        <div className="lg:pl-[220px]">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden">
            <button
              onClick={() => setSidebarOpen((value) => !value)}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700"
              aria-label="Open navigation"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-[12px] font-bold text-[#096B4A]">{routePending ? "Loading" : "Live"}</span>
          </header>

          <main className="mx-auto min-h-screen max-w-[1480px] px-5 py-6 md:px-8 lg:px-10">{children}</main>
        </div>
      </div>

      <style jsx global>{`
        .sidebar-scroll::-webkit-scrollbar { width: 3px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 10px; }
      `}</style>
    </CurrencyProvider>
  );
}
