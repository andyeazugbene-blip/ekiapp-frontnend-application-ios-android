"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import { DataTable, FilterSelect, SearchInput, StatusTabs, formatDate, formatMinor, useConfirm, type Column } from "@/components/AdminKit";
import { Field, FormModal, inputClass, textareaClass } from "@/components/FormModal";
import { NoAccess } from "@/components/PageStates";
import { APIError } from "@/lib/api";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { SUPPORTED_CURRENCIES, formatApproxMoney, useAdminDisplayCurrency } from "@/lib/displayCurrency";
import { giftsAPI, rewardLifecycle, type Reward, type RewardLifecycle, type RewardType } from "@/lib/services/gifts.api";

const TYPE_LABEL: Record<RewardType, string> = { WALLET_BONUS: "Wallet bonus", DISCOUNT_COUPON: "Discount coupon", FREE_SHIPPING: "Free shipping" };
const KIND_TABS = [
  { key: "deals", label: "Hot Deals" },
  { key: "rewards", label: "Gift rewards" },
  { key: "all", label: "All" },
];
const LIFECYCLE_TONE: Record<RewardLifecycle, "green" | "amber" | "gray" | "red"> = { active: "green", paused: "amber", archived: "gray", expired: "red" };
const LIFECYCLE_LABEL: Record<RewardLifecycle, string> = { active: "Active", paused: "Paused", archived: "Archived", expired: "Expired" };

interface FormState {
  id: string | null;
  kind: "HOT_DEAL" | "GIFT";
  name: string; description: string; type: RewardType; value: string; currency: string;
  minOrderAmount: string; maxClaims: string; expiresAt: string; reason: string;
}

function HotDealsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const perms = usePermissions();
  const { selectedCurrency } = useAdminDisplayCurrency("EUR");
  const confirm = useConfirm();

  const kind = params.get("kind") ?? "deals";
  const status = params.get("status") ?? "";
  const q = params.get("q") ?? "";
  const setParams = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v == null || v === "") next.delete(k); else next.set(k, v); }
    router.replace(`${pathname}?${next.toString()}`);
  }, [params, pathname, router]);

  const [items, setItems] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    try { setLoading(true); setError(""); setItems(await giftsAPI.getGifts(true)); }
    catch (e) { setError(e instanceof APIError ? e.message : "Failed to load hot deals"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (perms.loading || perms.has("rewards.read")) void load(); }, [load, perms]);

  const filtered = useMemo(() => items.filter((r) => {
    if (kind === "deals" && !r.isHotDeal) return false;
    if (kind === "rewards" && r.isHotDeal) return false;
    if (status && rewardLifecycle(r) !== status) return false;
    if (q && !`${r.name} ${r.description ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [items, kind, status, q]);

  if (!perms.loading && !perms.has("rewards.read")) return <NoAccess what="hot deals" />;
  const canMutate = perms.has("rewards.mutate");

  const blank = (k: "HOT_DEAL" | "GIFT"): FormState => ({
    id: null, kind: k, name: "", description: "", type: k === "HOT_DEAL" ? "DISCOUNT_COUPON" : "WALLET_BONUS", value: "",
    currency: selectedCurrency, minOrderAmount: "", maxClaims: "", expiresAt: "", reason: "",
  });
  const openNew = () => { setFormError(""); setForm(blank(kind === "rewards" ? "GIFT" : "HOT_DEAL")); };
  const openEdit = (r: Reward) => {
    setFormError("");
    setForm({
      id: r.id, kind: r.isHotDeal ? "HOT_DEAL" : "GIFT", name: r.name, description: r.description ?? "", type: r.type,
      value: String(r.value), currency: r.currency, minOrderAmount: r.minOrderAmount ? String(r.minOrderAmount) : "",
      maxClaims: r.maxClaims ? String(r.maxClaims) : "", expiresAt: r.expiresAt ? r.expiresAt.slice(0, 16) : "", reason: "",
    });
  };

  const save = async () => {
    if (!form) return;
    if (!form.name.trim() || !form.value || Number(form.value) <= 0) { setFormError("Name and a value above zero are required."); return; }
    if (form.kind === "HOT_DEAL" && (!form.minOrderAmount || Number(form.minOrderAmount) <= 0)) {
      setFormError("A minimum order amount is required: the buyer must spend at least this much to unlock the deal."); return;
    }
    try {
      setSaving(true); setFormError("");
      const payload = {
        name: form.name.trim(), description: form.description.trim() || undefined, type: form.type, value: Number(form.value), currency: form.currency,
        minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : undefined,
        maxClaims: form.maxClaims ? Number(form.maxClaims) : undefined,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
        isHotDeal: form.kind === "HOT_DEAL",
      };
      if (form.id) await giftsAPI.updateGift(form.id, payload, form.reason);
      else await giftsAPI.createGift(payload);
      setForm(null);
      await load();
    } catch (e) { setFormError(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  };

  const ask = (r: Reward, action: "pause" | "resume" | "archive") =>
    confirm.ask(
      {
        title: `${action === "pause" ? "Pause" : action === "resume" ? "Resume" : "Archive"} "${r.name}"?`,
        description: action === "archive"
          ? "Archived items disappear from the app and can't be resumed. Claims and history are kept."
          : action === "pause" ? "Buyers can no longer see or claim this. You can resume it any time." : "Buyers can see and claim this again.",
        confirmLabel: action === "pause" ? "Pause" : action === "resume" ? "Resume" : "Archive",
        tone: action === "resume" ? "primary" : "danger",
      },
      async (reason) => { await giftsAPI.setState(r.id, action, reason); await load(); },
    );

  const columns: Column<Reward>[] = [
    { key: "n", header: "Name", render: (r) => <div><p className="font-black text-slate-900">{r.name}</p>{r.description ? <p className="max-w-xs truncate text-xs font-semibold text-slate-500">{r.description}</p> : null}</div> },
    { key: "k", header: "Kind", render: (r) => <Badge tone={r.isHotDeal ? "amber" : "gray"}>{r.isHotDeal ? "Hot deal" : TYPE_LABEL[r.type]}</Badge> },
    {
      key: "v", header: "Value",
      render: (r) => {
        const approx = formatApproxMoney(r.value, r.currency, selectedCurrency);
        return (
          <div>
            <p className="font-black text-slate-900">{formatMinor(Math.round(r.value * 100), r.currency)}</p>
            {r.minOrderAmount ? <p className="text-xs font-semibold text-slate-500">Min order {formatMinor(Math.round(r.minOrderAmount * 100), r.currency)}</p> : null}
            {approx ? <p className="text-xs font-semibold text-slate-500">{approx}</p> : null}
          </div>
        );
      },
    },
    { key: "c", header: "Claims", render: (r) => <span className="font-bold">{r.maxClaims ? `${r.claimedCount}/${r.maxClaims}` : r.claimedCount}</span> },
    { key: "e", header: "Expires", render: (r) => <span className="text-xs font-semibold text-slate-600">{r.expiresAt ? formatDate(r.expiresAt) : "No expiry"}</span> },
    { key: "s", header: "Status", render: (r) => { const l = rewardLifecycle(r); return <Badge tone={LIFECYCLE_TONE[l]}>{LIFECYCLE_LABEL[l]}</Badge>; } },
    {
      key: "a", header: "", className: "text-right",
      render: (r) => canMutate && !r.archivedAt ? (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" className="h-9 px-3" onClick={() => openEdit(r)}>Edit</Button>
          {r.isActive
            ? <Button variant="ghost" className="h-9 px-3" onClick={() => ask(r, "pause")}>Pause</Button>
            : <Button variant="secondary" className="h-9 px-3" onClick={() => ask(r, "resume")}>Resume</Button>}
          <Button variant="ghost" className="h-9 px-3 text-red-600" onClick={() => ask(r, "archive")}>Archive</Button>
        </div>
      ) : null,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Hot Deals"
        subtitle="Time-limited deals and gift rewards. Items are paused or archived, never deleted, so claim history stays intact."
        actions={canMutate ? <Button onClick={openNew}>New {kind === "rewards" ? "gift reward" : "hot deal"}</Button> : null}
      />
      {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
      <Card className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchInput value={q} onChange={(v) => setParams({ q: v })} placeholder="Search by name or description" />
          <FilterSelect label="Status" value={status} onChange={(v) => setParams({ status: v })} options={[
            { value: "", label: "Any status" }, { value: "active", label: "Active" }, { value: "paused", label: "Paused" },
            { value: "expired", label: "Expired" }, { value: "archived", label: "Archived" },
          ]} />
        </div>
        <StatusTabs tabs={KIND_TABS} active={kind} onChange={(k) => setParams({ kind: k === "deals" ? null : k })} />
        {loading && items.length === 0 ? <LoadingPanel label="Loading…" /> : <DataTable columns={columns} rows={filtered} rowKey={(r) => r.id} loading={loading} emptyTitle="Nothing matches these filters" />}
      </Card>

      <FormModal
        open={Boolean(form)} title={form?.id ? "Edit" : form?.kind === "HOT_DEAL" ? "New hot deal" : "New gift reward"} onClose={() => setForm(null)}
        onSubmit={save} loading={saving} error={formError} wide
        canSubmit={Boolean(form && (!form.id || form.reason.trim().length >= 5))}
        submitLabel={form?.id ? "Save changes" : "Create"}
      >
        {form ? (
          <>
            {!form.id ? (
              <Field label="Kind">
                <select className={inputClass} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "HOT_DEAL" | "GIFT", type: e.target.value === "HOT_DEAL" ? "DISCOUNT_COUPON" : form.type })}>
                  <option value="HOT_DEAL">Hot deal</option><option value="GIFT">Gift reward</option>
                </select>
              </Field>
            ) : null}
            <Field label="Name"><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Description"><textarea className={textareaClass} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Type">
                <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as RewardType })}>
                  {(Object.keys(TYPE_LABEL) as RewardType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
              </Field>
              <Field label="Value"><input className={inputClass} type="number" min="0" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></Field>
              <Field label="Currency">
                <select className={inputClass} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  {SUPPORTED_CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={form.kind === "HOT_DEAL" ? "Min order amount (required)" : "Min order amount"}><input className={inputClass} type="number" min="0" step="0.01" value={form.minOrderAmount} onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })} /></Field>
              <Field label="Max claims"><input className={inputClass} type="number" min="1" placeholder="Unlimited" value={form.maxClaims} onChange={(e) => setForm({ ...form, maxClaims: e.target.value })} /></Field>
              <Field label="Expires at"><input className={inputClass} type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></Field>
            </div>
            {form.id ? <Field label="Reason for change (recorded in the audit log)"><textarea className={textareaClass} rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="At least 5 characters" /></Field> : null}
          </>
        ) : null}
      </FormModal>
      {confirm.dialog}
    </div>
  );
}

export default function HotDealsPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Suspense fallback={<LoadingPanel label="Loading hot deals…" />}>
          <HotDealsInner />
        </Suspense>
      </AdminLayout>
    </ProtectedRoute>
  );
}
