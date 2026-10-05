"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { CurrencyProvider, useCurrency } from "@/contexts/CurrencyContext";
import GlobalSearch from "@/components/GlobalSearch";
import { PageErrorBoundary } from "@/components/PageStates";
import { useActionCentre } from "@/lib/hooks/useActionCentre";
import { permissionMatches, usePermissions } from "@/lib/hooks/usePermissions";

/**
 * Sidebar organised into the handbook's workflow modules (§2 L110-128).
 * Items are hidden when the admin's role lacks the read permission; Overview
 * is always shown. Permissions come from usePermissions(); while they are
 * unknown everything is shown (the server still enforces every call).
 */

type BadgeKey = "verification" | "disputes" | "payments" | "conversations" | "subscriptions";

interface NavItem {
  name: string;
  href: string;
  /** Any-of permission(s) needed to see the item. Omit = always visible. */
  perm?: string[];
  badge?: BadgeKey;
  children?: NavItem[];
  /** Extra path prefixes that count as "inside" this item (legacy / sibling routes). */
  also?: string[];
}

interface NavModule {
  label: string;
  items: NavItem[];
}

export const NAV_MODULES: NavModule[] = [
  { label: "OVERVIEW", items: [{ name: "Overview", href: "/dashboard" }] },
  {
    label: "PEOPLE",
    items: [
      { name: "Users", href: "/users", perm: ["users.read"] },
      { name: "Vendors", href: "/vendors", perm: ["vendors.read"] },
      { name: "Verification", href: "/verification", perm: ["verification.read"], badge: "verification" },
    ],
  },
  {
    label: "COMMERCE",
    items: [
      { name: "Orders", href: "/orders", perm: ["orders.read"] },
      {
        name: "Payments & Payouts", href: "/payments", perm: ["orders.read"], badge: "payments", also: ["/wallet-transactions"],
        children: [
          { name: "Payouts", href: "/payout-requests", perm: ["payouts.read"] },
          { name: "Refunds", href: "/refunds", perm: ["orders.read"] },
          { name: "Ledger", href: "/ledger", perm: ["audit.read"] },
          { name: "Anomalies", href: "/payment-anomalies", perm: ["reports.read"] },
          { name: "Stripe disputes", href: "/stripe-disputes", perm: ["disputes.read"] },
        ],
      },
      { name: "Disputes", href: "/disputes", perm: ["disputes.read"], badge: "disputes" },
      { name: "Products", href: "/products", perm: ["products.read"] },
      {
        name: "Foodstuffs Subscriptions", href: "/subscriptions", perm: ["subscriptions.read"], badge: "subscriptions",
        children: [{ name: "Exceptions", href: "/subscription-exceptions", perm: ["subscriptions.read"] }],
      },
      { name: "Gift Cards & Hot Deals", href: "/gift-cards", perm: ["rewards.read"], also: ["/hot-deals", "/gifts"] },
      { name: "Promo codes", href: "/promo-codes", perm: ["promos.read"] },
      { name: "Reviews", href: "/reviews", perm: ["reviews.read"] },
    ],
  },
  {
    label: "COMMUNITY BUY",
    items: [
      {
        name: "Community Buy", href: "/community-campaigns", perm: ["community_buy.read"],
        children: [
          { name: "Campaigns", href: "/community-campaigns" },
          { name: "Markets", href: "/community-markets" },
          { name: "Verification", href: "/community-verification" },
          { name: "Supplier accounts", href: "/community-supplier-accounts" },
          { name: "Supplier payments", href: "/community-supplier-payments" },
          { name: "Organiser fees", href: "/community-organiser-fees" },
          { name: "Payouts", href: "/community-buy-payouts" },
          { name: "Refunds", href: "/community-refunds" },
          { name: "Ledger", href: "/community-ledger" },
          { name: "Support cases", href: "/community-support-cases" },
          { name: "Fulfilment delays", href: "/fulfilment-delays" },
          { name: "Data access log", href: "/community-data-access" },
        ],
      },
    ],
  },
  {
    label: "GROWTH & COMMS",
    items: [
      { name: "Automations", href: "/automation", perm: ["analytics.read"] },
      { name: "Communications", href: "/communications", perm: ["communications.read", "communications.send"], also: ["/communication"] },
      { name: "Conversations", href: "/support-messages", perm: ["support.read"], badge: "conversations" },
      { name: "Content Review", href: "/content-review", perm: ["reports.read", "verification.read"], also: ["/uploads", "/content-reports"] },
      { name: "Send Offer", href: "/send-offer", perm: ["communications.send"] },
      { name: "Campaigns", href: "/campaigns", perm: ["campaigns.read"] },
      { name: "Analytics", href: "/analytics", perm: ["analytics.read"] },
    ],
  },
  {
    label: "ADMIN",
    items: [
      { name: "Settings", href: "/settings", perm: ["settings.read"] },
      { name: "Audit log", href: "/activity-logs", perm: ["audit.read"] },
      { name: "Approvals", href: "/approvals", perm: ["approvals.read"] },
      { name: "Seller plans", href: "/subscription-plans", perm: ["subscriptions.read"] },
      { name: "Delivery zones", href: "/delivery-zones", perm: ["delivery_zones.read"] },
    ],
  },
];

function canSee(perms: string[] | null, anyOf?: string[]): boolean {
  if (!anyOf || anyOf.length === 0 || perms === null) return true;
  return anyOf.some((p) => permissionMatches(perms, p));
}

function filterItems(items: NavItem[], perms: string[] | null): NavItem[] {
  return items
    .filter((i) => canSee(perms, i.perm))
    .map((i) => (i.children ? { ...i, children: filterItems(i.children, perms) } : i));
}

function inPath(pathname: string | null, href: string): boolean {
  return !!pathname && (pathname === href || pathname.startsWith(`${href}/`));
}

function isItemActive(pathname: string | null, item: NavItem): boolean {
  return inPath(pathname, item.href)
    || (item.also ?? []).some((p) => inPath(pathname, p))
    || (item.children ?? []).some((c) => isItemActive(pathname, c));
}

/** Longest-prefix lookup for breadcrumbs. */
function findCrumb(pathname: string | null): { module: string; item: NavItem; matched: string } | null {
  if (!pathname) return null;
  let best: { module: string; item: NavItem; matched: string } | null = null;
  const visit = (module: string, item: NavItem) => {
    for (const h of [item.href, ...(item.also ?? [])]) {
      if (inPath(pathname, h) && (!best || h.length > best.matched.length)) best = { module, item, matched: h };
    }
    item.children?.forEach((c) => visit(module, c));
  };
  NAV_MODULES.forEach((m) => m.items.forEach((i) => visit(m.label, i)));
  return best;
}

function titleCase(label: string): string {
  return label.charAt(0) + label.slice(1).toLowerCase();
}

function Breadcrumbs({ pathname }: { pathname: string | null }) {
  const crumb = findCrumb(pathname);
  if (!crumb || pathname === "/dashboard") {
    return <span className="truncate text-sm font-bold text-[#101820]">Overview</span>;
  }
  const deeper = pathname !== crumb.matched;
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
      <span className="hidden text-slate-400 sm:inline">{titleCase(crumb.module)}</span>
      <span className="hidden text-slate-300 sm:inline">/</span>
      {deeper ? (
        <>
          <Link href={crumb.item.href} className="truncate font-semibold text-slate-500 hover:text-[#096B4A]">{crumb.item.name}</Link>
          <span className="text-slate-300">/</span>
          <span className="font-bold text-[#101820]">Details</span>
        </>
      ) : (
        <span className="truncate font-bold text-[#101820]">{crumb.item.name}</span>
      )}
    </nav>
  );
}

function SidebarCurrency() {
  const { selectedCurrency, setSelectedCurrency, currencyOptions } = useCurrency();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative px-5 py-3">
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg bg-white/10 px-3 py-2 text-[13px] font-semibold text-white/80 hover:bg-white/15 transition"
      >
        <span>Currency: {selectedCurrency}</span>
        <svg className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <p className="mt-1.5 px-1 text-[10px] leading-snug text-white/50" title="Converted using a fixed reference rate, not a live feed. Original-currency amounts are always shown first.">
        Converted amounts are approximate
      </p>
      {open && (
        <div role="listbox" className="absolute bottom-full left-5 right-5 mb-1 rounded-xl border border-white/10 bg-[#0a3d2a] p-2 shadow-lg">
          {currencyOptions.map((code) => (
            <button
              key={code}
              role="option"
              aria-selected={code === selectedCurrency}
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

function CountBadge({ count, tone = "amber" }: { count?: number; tone?: "amber" | "red" }) {
  if (!count) return null;
  return (
    <span
      aria-label={`${count} need attention`}
      className={`ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-black ${tone === "red" ? "bg-red-500 text-white" : "bg-amber-400 text-[#3b2a00]"}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

const OPEN_KEY = "eki_admin_nav_open";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [routePending, setRoutePending] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [tz, setTz] = useState("");
  const { data, fetchedAt, refresh, loading } = useActionCentre(false);

  // Permissions come from usePermissions() (GET /admin/me/permissions); while unknown or on error everything is shown (the server still enforces each call).
  const { access } = usePermissions();
  const perms = access?.permissions ?? null;
  const modules = useMemo(
    () => NAV_MODULES
      .map((m) => ({ ...m, items: filterItems(m.items, perms) }))
      .filter((m) => m.items.length > 0 || m.label === "OVERVIEW"),
    [perms],
  );

  useEffect(() => {
    setRoutePending(false);
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(OPEN_KEY);
      if (raw) setOpenGroups(JSON.parse(raw));
    } catch { /* storage unavailable */ }
    try {
      const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" }).formatToParts(new Date());
      setTz(parts.find((p) => p.type === "timeZoneName")?.value ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch { /* ignore */ }
  }, []);

  const toggleGroup = (href: string, current: boolean) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [href]: !current };
      try { window.localStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const handleNavigate = (href: string) => {
    if (pathname === href) return;
    setRoutePending(true);
    router.push(href);
  };

  const updatedLabel = fetchedAt
    ? new Date(fetchedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  const renderLink = (item: NavItem, depth: number) => {
    const active = isItemActive(pathname, item);
    const exact = inPath(pathname, item.href) || (item.also ?? []).some((p) => inPath(pathname, p));
    const hasChildren = !!item.children?.length;
    const expanded = hasChildren && (openGroups[item.href] ?? active);
    const badgeCount = item.badge ? data?.badges?.[item.badge] : undefined;
    return (
      <div key={item.href}>
        <div className="flex items-center">
          <Link
            href={item.href}
            prefetch={false}
            onMouseEnter={() => router.prefetch(item.href)}
            onClick={(event) => {
              event.preventDefault();
              handleNavigate(item.href);
            }}
            aria-current={exact ? "page" : undefined}
            className={`group flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-[7px] pr-2 text-[13px] font-medium transition ${depth ? "pl-8" : "pl-3"} ${
              exact ? "bg-white/15 font-semibold text-white" : active ? "text-white" : "text-white/65 hover:bg-white/8 hover:text-white/90"
            }`}
          >
            {depth === 0 ? <span className={`h-[5px] w-[5px] shrink-0 rounded-full ${active ? "bg-white" : "bg-white/30"}`} /> : null}
            <span className="truncate">{item.name}</span>
            {routePending && exact ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> : null}
            <CountBadge count={badgeCount} tone={item.badge === "disputes" || item.badge === "payments" ? "red" : "amber"} />
          </Link>
          {hasChildren ? (
            <button
              onClick={() => toggleGroup(item.href, !!expanded)}
              aria-label={`${expanded ? "Collapse" : "Expand"} ${item.name}`}
              aria-expanded={expanded}
              className="ml-0.5 rounded-md p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
            >
              <svg className={`h-3.5 w-3.5 transition ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          ) : null}
        </div>
        {hasChildren && expanded ? (
          <div className="mb-1 mt-0.5 space-y-0.5 border-l border-white/10 pl-1 ml-4">
            {item.children!.map((c) => renderLink(c, 1))}
          </div>
        ) : null}
      </div>
    );
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
          aria-label="Main navigation"
          className={`fixed inset-y-0 left-0 z-40 w-[250px] transform transition-transform duration-300 lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{ background: "linear-gradient(180deg, #0d4a34 0%, #0a3527 40%, #072a1e 100%)" }}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-2.5 px-5 py-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500">
                <svg viewBox="0 0 20 20" className="h-4.5 w-4.5 text-white" fill="currentColor">
                  <path d="M10 2L3 7v11h5v-6h4v6h5V7l-7-5z" />
                </svg>
              </div>
              <span className="text-[15px] font-bold text-white tracking-tight">Eki Admin</span>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 pb-2 sidebar-scroll">
              {modules.map((module) => (
                <div key={module.label} className="mb-3">
                  <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-400/90">{module.label}</p>
                  {module.items.map((item) => renderLink(item, 0))}
                </div>
              ))}
            </nav>

            <SidebarCurrency />

            <div className="border-t border-white/10 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-[12px] font-bold text-white">
                  {user?.name?.charAt(0)?.toUpperCase() || "A"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-white">{user?.name || "Admin"}</p>
                  <p className="truncate text-[10px] text-white/50">{user?.email || "admin@eki.com"}</p>
                </div>
                <button onClick={logout} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-red-300 transition" title="Sign out" aria-label="Sign out">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </aside>

        <div className="lg:pl-[250px]">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-8 lg:px-10">
            <button
              onClick={() => setSidebarOpen((value) => !value)}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 lg:hidden"
              aria-label="Open navigation"
              aria-expanded={sidebarOpen}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="min-w-0 flex-1"><Breadcrumbs pathname={pathname} /></div>
            <GlobalSearch />
            <div className="hidden items-center gap-2 text-[11px] font-semibold text-slate-500 md:flex" title="Queue counts refresh every 60 seconds">
              <span>{updatedLabel ? `Updated ${updatedLabel}` : loading ? "Loading…" : "Not refreshed"}{tz ? ` ${tz}` : ""}</span>
              <button
                onClick={() => void refresh()}
                aria-label="Refresh now"
                className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50"
              >
                <svg className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" />
                </svg>
              </button>
            </div>
          </header>

          <main className="mx-auto min-h-screen max-w-[1480px] px-5 py-6 md:px-8 lg:px-10">
            <PageErrorBoundary resetKey={pathname ?? ""}>{children}</PageErrorBoundary>
          </main>
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
