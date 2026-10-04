"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader, TwoFactorModal, downloadCsv } from "@/components/AdminUI";
import { Banner, DataTable, FilterSelect, Pagination, SearchInput, StatusTabs, formatDate, timeAgo, type Column } from "@/components/AdminKit";
import { SuspendDialog } from "@/components/SuspendDialog";
import { APIError } from "@/lib/api";
import { useTwoFactorAction } from "@/lib/hooks/useTwoFactorAction";
import { peopleAPI, userState, type UserRow } from "@/lib/services/people.api";

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "active", label: "Active" },
  { key: "suspended", label: "Suspended" },
  { key: "anonymised", label: "Anonymised" },
];
const ROLE_OPTIONS = [
  { value: "", label: "Any role" },
  { value: "BUYER", label: "Buyers" },
  { value: "VENDOR", label: "Vendors" },
  { value: "ADMIN", label: "Admins" },
];

function stateBadge(u: UserRow) {
  const s = userState(u);
  if (s === "anonymised") return <Badge tone="gray">Anonymised</Badge>;
  if (s === "suspended") return <Badge tone="red">Suspended</Badge>;
  return <Badge tone="green">Active</Badge>;
}

function Avatar({ u }: { u: UserRow }) {
  const initials = (u.name || u.email || "?").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return u.avatar && !u.anonymisedAt
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={u.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
    : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-500" aria-hidden>{initials}</span>;
}

function UsersInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const role = params.get("role") ?? "";
  const includeTest = params.get("includeTest") === "true";

  const setParams = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v == null || v === "") next.delete(k); else next.set(k, v); }
    router.replace(`${pathname}?${next.toString()}`);
  }, [params, pathname, router]);

  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const stack = useRef<Array<string | null>>([]);
  const [target, setTarget] = useState<{ user: UserRow; mode: "suspend" | "restore" } | null>(null);
  const twoFactor = useTwoFactorAction();

  const key = `${q}|${status}|${role}|${includeTest}`;
  useEffect(() => { stack.current = []; setCursor(null); }, [key]);

  const load = useCallback(async () => {
    try {
      setLoading(true); setError("");
      const res = await peopleAPI.listUsers({ q, status, role, includeTest, cursor });
      setRows(res.items); setNextCursor(res.nextCursor); setTotal(res.total);
    } catch (e) { setError(e instanceof APIError ? e.message : "Failed to load users"); }
    finally { setLoading(false); }
  }, [q, status, role, includeTest, cursor]);
  useEffect(() => { void load(); }, [load]);

  const columns: Column<UserRow>[] = [
    {
      key: "user", header: "User",
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar u={u} />
          <div>
            <p className="font-black text-slate-900">{u.anonymisedAt ? "Anonymised user" : u.name || "Name not provided"}{u.isTest ? <span className="ml-2"><Badge tone="amber">TEST</Badge></span> : null}</p>
            <p className="text-xs font-semibold text-slate-500">{u.anonymisedAt ? "Personal data removed" : u.email}</p>
          </div>
        </div>
      ),
    },
    { key: "role", header: "Role", render: (u) => <div className="space-y-1"><Badge tone={u.role === "ADMIN" ? "blue" : u.role === "VENDOR" ? "green" : "gray"}>{u.role}</Badge>{u.storeName ? <p className="text-xs font-semibold text-slate-500">{u.storeName}</p> : null}</div> },
    { key: "state", header: "Status", render: stateBadge },
    { key: "orders", header: "Orders", render: (u) => <span className="font-bold">{u.orderCount}</span> },
    { key: "last", header: "Last active", render: (u) => <span className="text-xs font-semibold text-slate-600">{u.lastActiveAt ? timeAgo(u.lastActiveAt) : "Not tracked"}</span> },
    { key: "joined", header: "Joined", render: (u) => <span className="text-xs font-semibold text-slate-600">{formatDate(u.createdAt)}</span> },
    {
      key: "act", header: "", className: "text-right",
      render: (u) => (
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" className="h-9 px-3" onClick={() => router.push(`/users/${u.id}`)}>View</Button>
          {/* Anonymised accounts can never be suspended or restored (handbook 14.5). */}
          {u.role === "ADMIN" || u.anonymisedAt ? null : u.isSuspended
            ? <Button variant="secondary" className="h-9 px-3" onClick={() => setTarget({ user: u, mode: "restore" })}>Restore</Button>
            : <Button variant="ghost" className="h-9 px-3 text-red-600" onClick={() => setTarget({ user: u, mode: "suspend" })}>Suspend</Button>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        subtitle="Search any account by name, email, store or ID. Anonymised accounts are shown as such and can never be reactivated."
        actions={<Button variant="ghost" onClick={() => downloadCsv("users.csv", rows.map((u) => ({ id: u.id, name: u.anonymisedAt ? "" : u.name, email: u.anonymisedAt ? "" : u.email, role: u.role, status: userState(u), orders: u.orderCount, joined: u.createdAt })))}>Export page (CSV)</Button>}
      />
      {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
      {twoFactor.error ? <Banner tone="danger">{twoFactor.error}</Banner> : null}

      <Card className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchInput value={q} onChange={(v) => setParams({ q: v })} placeholder="Search name, email, store or user ID" />
          <FilterSelect label="Role" value={role} onChange={(v) => setParams({ role: v })} options={ROLE_OPTIONS} />
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <input type="checkbox" checked={includeTest} onChange={(e) => setParams({ includeTest: e.target.checked ? "true" : null })} className="h-4 w-4 accent-[#096B4A]" />
            Include test records
          </label>
        </div>
        <StatusTabs tabs={STATUS_TABS} active={status} onChange={(k) => setParams({ status: k })} />
        {loading && rows.length === 0 ? <LoadingPanel label="Loading users…" /> : (
          <>
            <DataTable columns={columns} rows={rows} rowKey={(u) => u.id} onRowClick={(u) => router.push(`/users/${u.id}`)} loading={loading} emptyTitle="No users match these filters" />
            <Pagination
              hasPrev={stack.current.length > 0} hasNext={Boolean(nextCursor)} shown={rows.length} total={total} loading={loading}
              onPrev={() => setCursor(stack.current.pop() ?? null)}
              onNext={() => { stack.current.push(cursor); setCursor(nextCursor); }}
            />
          </>
        )}
      </Card>

      <SuspendDialog
        open={Boolean(target)} mode={target?.mode ?? "suspend"} subject={target?.user.name || target?.user.email || "this user"}
        onCancel={() => setTarget(null)}
        onSubmit={async (values) => {
          if (!target) return;
          await twoFactor.run(async (code) => {
            if (target.mode === "suspend") await peopleAPI.suspendUser(target.user.id, values, code);
            else await peopleAPI.unsuspendUser(target.user.id, { reason: values.reason, notifyUser: values.notifyUser }, code);
            setTarget(null);
            await load();
          });
        }}
      />
      <TwoFactorModal
        open={twoFactor.show2FAModal} code={twoFactor.code} onCodeChange={twoFactor.setCode}
        onSubmit={() => void twoFactor.submit2FA()} onCancel={twoFactor.cancel2FA} loading={twoFactor.loading} error={twoFactor.error}
      />
    </div>
  );
}

export default function UsersPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Suspense fallback={<LoadingPanel label="Loading users…" />}>
          <UsersInner />
        </Suspense>
      </AdminLayout>
    </ProtectedRoute>
  );
}
