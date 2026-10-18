"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader, TwoFactorModal, downloadCsv } from "@/components/AdminUI";
import { Banner, DataTable, FilterSelect, Pagination, SearchInput, StatusTabs, formatDate, timeAgo, useConfirm, type Column } from "@/components/AdminKit";
import { SuspendDialog } from "@/components/SuspendDialog";
import { DemoAccountDialog } from "@/components/DemoAccountDialog";
import { APIError } from "@/lib/api";
import { useTwoFactorAction } from "@/lib/hooks/useTwoFactorAction";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { peopleAPI, userState, type UserRow } from "@/lib/services/people.api";

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "active", label: "Active" },
  { key: "suspended", label: "Suspended" },
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
  const [demoDialogOpen, setDemoDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState<"suspend" | "restore" | null>(null);
  const twoFactor = useTwoFactorAction();
  const perms = usePermissions();
  const canSuspend = perms.has("users.mutate");
  const canDelete = perms.has("users.mutate");
  const confirm = useConfirm();

  const key = `${q}|${status}|${role}|${includeTest}`;
  useEffect(() => { stack.current = []; setCursor(null); setSelected(new Set()); }, [key]);

  // Admin and anonymised accounts never show individual suspend/delete
  // actions either (see the row-level gates below) — a selection can only
  // ever be acted on if every member of it is eligible, same rule, bulk.
  const selectableRows = rows.filter((u) => u.role !== "ADMIN" && !u.anonymisedAt);
  const toggleOne = (id: string) =>
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleAll = () =>
    setSelected((prev) =>
      prev.size === selectableRows.length && selectableRows.every((u) => prev.has(u.id))
        ? new Set()
        : new Set(selectableRows.map((u) => u.id)),
    );

  const bulkDelete = () =>
    confirm.ask(
      {
        title: `Delete ${selected.size} selected ${selected.size === 1 ? "account" : "accounts"}?`,
        description: "Each account with no real order/payment/review history is permanently removed. Any that do have history are anonymised and suspended instead — their data is scrubbed but the order history stays intact, and the same email is freed to sign up fresh. A per-account result is shown after.",
        confirmLabel: "Delete selected",
        reasonLabel: "Reason (recorded in the audit log)",
      },
      async (reason) => {
        const result = await peopleAPI.bulkDeleteUsers([...selected], reason);
        setSelected(new Set());
        await load();
        const failed = result.results.filter((r) => !r.ok);
        if (failed.length) setError(`${result.affected} deleted, ${failed.length} failed: ${failed.map((f) => f.error).join("; ")}`);
      },
    );

  const load = useCallback(async () => {
    try {
      setLoading(true); setError("");
      const res = await peopleAPI.listUsers({ q, status, role, includeTest, cursor });
      setRows(res.items); setNextCursor(res.nextCursor); setTotal(res.total);
    } catch (e) { setError(e instanceof APIError ? e.message : "Failed to load users"); }
    finally { setLoading(false); }
  }, [q, status, role, includeTest, cursor]);
  useEffect(() => { void load(); }, [load]);

  const deleteUser = (u: UserRow) =>
    confirm.ask(
      {
        title: `Delete ${u.name || u.email}?`,
        description: "If this account has no real order/payment/review history, the record is permanently removed. If it does, that history can never be erased — the account is anonymised and suspended instead (their email, name and other personal data are scrubbed, but the order history stays intact). This account will never be able to log in again, but the same email can sign up fresh.",
        confirmLabel: "Delete account",
        reasonLabel: "Reason (recorded in the audit log)",
      },
      async (reason) => {
        await peopleAPI.deleteUser(u.id, reason);
        await load();
      },
    );

  const columns: Column<UserRow>[] = [
    {
      key: "select",
      header: (
        <input
          type="checkbox"
          className="h-4 w-4 accent-[#096B4A]"
          checked={selectableRows.length > 0 && selected.size === selectableRows.length}
          onChange={toggleAll}
          aria-label="Select all eligible users on this page"
        />
      ),
      render: (u) =>
        u.role === "ADMIN" || u.anonymisedAt ? null : (
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#096B4A]"
            checked={selected.has(u.id)}
            onChange={() => toggleOne(u.id)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${u.name || u.email}`}
          />
        ),
    },
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
          {!canSuspend || u.role === "ADMIN" || u.anonymisedAt ? null : u.isSuspended
            ? <Button variant="secondary" className="h-9 px-3" onClick={() => setTarget({ user: u, mode: "restore" })}>Restore</Button>
            : <Button variant="ghost" className="h-9 px-3 text-red-600" onClick={() => setTarget({ user: u, mode: "suspend" })}>Suspend</Button>}
          {canDelete && u.role !== "ADMIN" && !u.anonymisedAt ? (
            <Button variant="danger" className="h-9 px-3" onClick={() => deleteUser(u)}>Delete</Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        subtitle="Search any account by name, email, store or ID. Deleted/anonymised accounts are no longer shown here."
        actions={
          <div className="flex gap-2">
            {canSuspend ? <Button variant="primary" onClick={() => setDemoDialogOpen(true)}>Create demo account</Button> : null}
            <Button variant="ghost" onClick={() => downloadCsv("users.csv", rows.map((u) => ({ id: u.id, name: u.anonymisedAt ? "" : u.name, email: u.anonymisedAt ? "" : u.email, role: u.role, status: userState(u), orders: u.orderCount, joined: u.createdAt })))}>Export page (CSV)</Button>
          </div>
        }
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
        {selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#096B4A]/20 bg-[#096B4A]/5 px-4 py-3">
            <span className="text-sm font-black text-[#096B4A]">{selected.size} selected</span>
            {canSuspend ? (
              <>
                <Button variant="secondary" className="h-9 px-3" onClick={() => setBulkMode("suspend")}>Suspend selected</Button>
                <Button variant="secondary" className="h-9 px-3" onClick={() => setBulkMode("restore")}>Restore selected</Button>
              </>
            ) : null}
            {canDelete ? <Button variant="danger" className="h-9 px-3" onClick={bulkDelete}>Delete selected</Button> : null}
            <Button variant="ghost" className="h-9 px-3" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        ) : null}
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
      <SuspendDialog
        open={Boolean(bulkMode)} mode={bulkMode ?? "suspend"} subject={`${selected.size} selected ${selected.size === 1 ? "user" : "users"}`}
        onCancel={() => setBulkMode(null)}
        onSubmit={async (values) => {
          if (!bulkMode) return;
          await twoFactor.run(async (code) => {
            const result =
              bulkMode === "suspend"
                ? await peopleAPI.bulkSuspendUsers([...selected], values, code)
                : await peopleAPI.bulkUnsuspendUsers([...selected], { reason: values.reason, notifyUser: values.notifyUser }, code);
            setBulkMode(null);
            setSelected(new Set());
            await load();
            const failed = result.results.filter((r) => !r.ok);
            if (failed.length) setError(`${result.affected} updated, ${failed.length} failed: ${failed.map((f) => f.error).join("; ")}`);
          });
        }}
      />
      <TwoFactorModal
        open={twoFactor.show2FAModal} code={twoFactor.code} onCodeChange={twoFactor.setCode}
        onSubmit={() => void twoFactor.submit2FA()} onCancel={twoFactor.cancel2FA} loading={twoFactor.loading} error={twoFactor.error}
      />
      {confirm.dialog}
      <DemoAccountDialog open={demoDialogOpen} onClose={() => setDemoDialogOpen(false)} onCreated={() => void load()} />
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
