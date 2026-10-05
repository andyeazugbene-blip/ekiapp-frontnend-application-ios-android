"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import {
  Banner, DataTable, ExternalLink, KeyValue, Pagination, SearchInput, StatusTabs, formatDate, formatDateTime, formatMinor,
  stripeDashboardUrl, useConfirm, type Column,
} from "@/components/AdminKit";
import { Field, FormModal, inputClass, textareaClass } from "@/components/FormModal";
import { NoAccess } from "@/components/PageStates";
import { APIError } from "@/lib/api";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { SUPPORTED_CURRENCIES, formatApproxMoney, useAdminDisplayCurrency } from "@/lib/displayCurrency";
import {
  giftCardsAPI, type GiftCardTemplate, type PurchasedGiftCardDetail, type PurchasedGiftCardRow, type PurchasedStatus,
} from "@/lib/services/gift-cards.api";

const STATUS_TONE: Record<PurchasedStatus, "green" | "amber" | "red" | "blue" | "gray"> = {
  PENDING_PAYMENT: "gray", ACTIVE: "green", PAUSED: "amber", REDEEMED: "blue", EXPIRED: "gray", CANCELLED: "red",
};
const STATUS_LABEL: Record<PurchasedStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment", ACTIVE: "Active", PAUSED: "Paused", REDEEMED: "Redeemed", EXPIRED: "Expired", CANCELLED: "Cancelled",
};
const PURCHASED_TABS = [
  { key: "", label: "All paid" },
  { key: "ACTIVE", label: "Active" },
  { key: "PAUSED", label: "Paused" },
  { key: "REDEEMED", label: "Redeemed" },
  { key: "EXPIRED", label: "Expired" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "PENDING_PAYMENT", label: "Awaiting payment" },
];

function Money({ minor, currency, display }: { minor: number; currency: string; display: string }) {
  const approx = formatApproxMoney(minor / 100, currency, display);
  return (
    <div>
      <p className="font-black text-slate-900">{formatMinor(minor, currency)}</p>
      {approx ? <p className="text-xs font-semibold text-slate-500">{approx}</p> : null}
    </div>
  );
}

// ─── Catalogue ──────────────────────────────────────────────────────────────

function CatalogueTab({ canMutate, display }: { canMutate: boolean; display: string }) {
  const [cards, setCards] = useState<GiftCardTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const confirm = useConfirm();
  const [form, setForm] = useState<{ id: string | null; title: string; description: string; price: string; currency: string; imageUrl: string; reason: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    try { setLoading(true); setError(""); setCards(await giftCardsAPI.listCatalogue(true)); }
    catch (e) { setError(e instanceof APIError ? e.message : "Failed to load gift cards"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const openNew = () => { setFormError(""); setForm({ id: null, title: "", description: "", price: "", currency: display, imageUrl: "", reason: "" }); };
  const openEdit = (c: GiftCardTemplate) => {
    setFormError("");
    setForm({ id: c.id, title: c.title, description: c.description ?? "", price: (c.priceAmount / 100).toFixed(2), currency: c.currency, imageUrl: c.imageUrl ?? "", reason: "" });
  };

  const save = async () => {
    if (!form) return;
    const priceMinor = Math.round(Number(form.price) * 100);
    if (!form.title.trim() || !Number.isFinite(priceMinor) || priceMinor <= 0) { setFormError("Title and a price above zero are required."); return; }
    try {
      setSaving(true); setFormError("");
      const body = { title: form.title.trim(), description: form.description.trim() || undefined, priceAmount: priceMinor, currency: form.currency, imageUrl: form.imageUrl.trim() || undefined };
      if (form.id) await giftCardsAPI.update(form.id, body, form.reason);
      else await giftCardsAPI.create(body);
      setForm(null);
      await load();
    } catch (e) { setFormError(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  };

  const ask = (c: GiftCardTemplate, action: "pause" | "resume" | "archive") =>
    confirm.ask(
      {
        title: `${action === "pause" ? "Pause" : action === "resume" ? "Resume" : "Archive"} "${c.title}"?`,
        description: action === "archive"
          ? "Archived gift cards disappear from the app and can't be resumed. Cards already purchased keep working and all history is kept."
          : action === "pause" ? "Buyers can no longer purchase this gift card. Already purchased cards are not affected." : "Buyers can purchase this gift card again.",
        confirmLabel: action === "pause" ? "Pause" : action === "resume" ? "Resume" : "Archive",
        tone: action === "resume" ? "primary" : "danger",
      },
      async (reason) => { await giftCardsAPI.setState(c.id, action, reason); await load(); },
    );

  const columns: Column<GiftCardTemplate>[] = [
    { key: "t", header: "Gift card", render: (c) => <div><p className="font-black text-slate-900">{c.title}</p>{c.description ? <p className="max-w-xs truncate text-xs font-semibold text-slate-500">{c.description}</p> : null}</div> },
    { key: "p", header: "Value", render: (c) => <Money minor={c.priceAmount} currency={c.currency} display={display} /> },
    { key: "s", header: "Status", render: (c) => c.archivedAt ? <Badge tone="gray">Archived</Badge> : c.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="amber">Paused</Badge> },
    { key: "n", header: "Purchased", render: (c) => <span className="font-bold">{c.purchasedCount ?? 0}</span> },
    { key: "d", header: "Created", render: (c) => <span className="text-xs font-semibold text-slate-600">{formatDate(c.createdAt)}</span> },
    {
      key: "a", header: "", className: "text-right",
      render: (c) => canMutate && !c.archivedAt ? (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" className="h-9 px-3" onClick={() => openEdit(c)}>Edit</Button>
          {c.isActive
            ? <Button variant="ghost" className="h-9 px-3" onClick={() => ask(c, "pause")}>Pause</Button>
            : <Button variant="secondary" className="h-9 px-3" onClick={() => ask(c, "resume")}>Resume</Button>}
          <Button variant="ghost" className="h-9 px-3 text-red-600" onClick={() => ask(c, "archive")}>Archive</Button>
        </div>
      ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">Gift card products buyers can purchase. Gift cards are paused or archived, never deleted.</p>
          {canMutate ? <Button onClick={openNew}>New gift card</Button> : null}
        </div>
        {loading ? <LoadingPanel label="Loading gift cards…" /> : <DataTable columns={columns} rows={cards} rowKey={(c) => c.id} emptyTitle="No gift cards yet" />}
      </Card>

      <FormModal
        open={Boolean(form)} title={form?.id ? "Edit gift card" : "New gift card"} onClose={() => setForm(null)}
        onSubmit={save} loading={saving} error={formError}
        canSubmit={Boolean(form && (!form.id || form.reason.trim().length >= 5))}
        submitLabel={form?.id ? "Save changes" : "Create gift card"}
      >
        {form ? (
          <>
            <Field label="Title"><input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Description"><textarea className={textareaClass} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Value" hint="In the card's own currency"><input className={inputClass} inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
              <Field label="Currency">
                <select className={inputClass} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  {SUPPORTED_CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Image URL (optional)"><input className={inputClass} value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} /></Field>
            {form.id ? <Field label="Reason for change (recorded in the audit log)"><textarea className={textareaClass} rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="At least 5 characters" /></Field> : null}
          </>
        ) : null}
      </FormModal>
      {confirm.dialog}
    </div>
  );
}

// ─── Purchased cards ────────────────────────────────────────────────────────

function PurchasedTab({ canMutate, display }: { canMutate: boolean; display: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const setParams = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v == null || v === "") next.delete(k); else next.set(k, v); }
    router.replace(`${pathname}?${next.toString()}`);
  }, [params, pathname, router]);

  const [rows, setRows] = useState<PurchasedGiftCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const stack = useRef<Array<string | null>>([]);
  const [detail, setDetail] = useState<PurchasedGiftCardDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const confirm = useConfirm();

  const key = `${q}|${status}`;
  useEffect(() => { stack.current = []; setCursor(null); }, [key]);

  const load = useCallback(async () => {
    try {
      setLoading(true); setError("");
      const res = await giftCardsAPI.listPurchased({ q, status, cursor });
      setRows(res.items); setNextCursor(res.nextCursor);
    } catch (e) { setError(e instanceof APIError ? e.message : "Failed to load purchased gift cards"); }
    finally { setLoading(false); }
  }, [q, status, cursor]);
  useEffect(() => { void load(); }, [load]);

  const open = async (id: string) => {
    try { setDetailError(""); setDetail(await giftCardsAPI.getPurchased(id)); }
    catch (e) { setError(e instanceof APIError ? e.message : "Failed to load gift card"); }
  };

  const ask = (d: PurchasedGiftCardDetail, action: "cancel" | "pause" | "resume") =>
    confirm.ask(
      {
        title: `${action === "cancel" ? "Cancel" : action === "pause" ? "Pause" : "Resume"} this gift card?`,
        description: action === "cancel"
          ? "The card can no longer be redeemed and this can't be undone. Cancelling does not refund the purchaser: refund the payment in Stripe if one is due. The purchaser is notified."
          : action === "pause" ? "Redemption is blocked until you resume it. The purchaser is notified." : "The card can be redeemed again. The purchaser is notified.",
        confirmLabel: action === "cancel" ? "Cancel gift card" : action === "pause" ? "Pause" : "Resume",
        tone: action === "resume" ? "primary" : "danger",
      },
      async (reason) => { setDetail(await giftCardsAPI.changePurchasedStatus(d.id, action, reason)); await load(); },
    );

  const columns: Column<PurchasedGiftCardRow>[] = [
    { key: "pu", header: "Purchaser", render: (r) => <div><p className="font-black text-slate-900">{r.purchaser?.name || "Name not provided"}</p><p className="text-xs font-semibold text-slate-500">{r.purchaser?.email ?? "Email not provided"}</p></div> },
    { key: "re", header: "Recipient", render: (r) => <div><p className="font-semibold text-slate-800">{r.recipientName || "Not provided"}</p><p className="text-xs font-semibold text-slate-500">{r.recipientEmail ?? "No email: purchaser shares the code"}</p></div> },
    { key: "o", header: "Original value", render: (r) => <Money minor={r.originalValue} currency={r.currency} display={display} /> },
    { key: "b", header: "Remaining", render: (r) => <Money minor={r.remainingBalance} currency={r.currency} display={display} /> },
    { key: "s", header: "Status", render: (r) => <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge> },
    { key: "pa", header: "Purchased", render: (r) => <span className="text-xs font-semibold text-slate-600">{formatDate(r.purchasedAt)}</span> },
    { key: "e", header: "Expires", render: (r) => <span className="text-xs font-semibold text-slate-600">{r.expiresAt ? formatDate(r.expiresAt) : "—"}</span> },
    { key: "a", header: "", className: "text-right", render: (r) => <Button variant="ghost" className="h-9 px-3" onClick={(e) => { e.stopPropagation(); void open(r.id); }}>View</Button> },
  ];

  return (
    <div className="space-y-4">
      {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
      <Card className="space-y-4">
        <SearchInput value={q} onChange={(v) => setParams({ q: v })} placeholder="Search purchaser, recipient, payment reference or last 4 of code" />
        <StatusTabs tabs={PURCHASED_TABS} active={status} onChange={(k) => setParams({ status: k })} />
        {loading && rows.length === 0 ? <LoadingPanel label="Loading purchased gift cards…" /> : (
          <>
            <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={(r) => void open(r.id)} loading={loading} emptyTitle="No purchased gift cards match" />
            <Pagination
              hasPrev={stack.current.length > 0} hasNext={Boolean(nextCursor)} shown={rows.length} loading={loading}
              onPrev={() => setCursor(stack.current.pop() ?? null)}
              onNext={() => { stack.current.push(cursor); setCursor(nextCursor); }}
            />
          </>
        )}
      </Card>

      {detail ? (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Purchased gift card">
          <Card className="my-8 w-full max-w-3xl space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-[#101820]">{detail.title}</h3>
                <p className="text-xs font-semibold text-slate-500">Code {detail.maskedCode ?? "not issued yet"} (full code is never shown to admins)</p>
              </div>
              <Badge tone={STATUS_TONE[detail.status]}>{STATUS_LABEL[detail.status]}</Badge>
            </div>
            {detail.statusReason && (detail.status === "CANCELLED" || detail.status === "PAUSED") ? <Banner tone="warning" title={`Reason recorded: ${detail.statusReason}`}>{formatDateTime(detail.statusChangedAt)}</Banner> : null}
            {detailError ? <Banner tone="danger">{detailError}</Banner> : null}
            <KeyValue items={[
              { label: "Purchaser", value: detail.purchaser ? `${detail.purchaser.name ?? "Name not provided"} (${detail.purchaser.email ?? "no email"})` : "Not provided" },
              { label: "Recipient", value: detail.recipientEmail ?? "Not provided" },
              { label: "Original value", value: formatMinor(detail.originalValue, detail.currency) },
              { label: "Remaining balance", value: formatMinor(detail.remainingBalance, detail.currency) },
              { label: "Purchased", value: formatDateTime(detail.purchasedAt) },
              { label: "Expires", value: detail.expiresAt ? formatDateTime(detail.expiresAt) : "Not set" },
              { label: "Message from purchaser", value: detail.message ?? "None" },
              { label: "Payment reference", value: detail.paymentReference ? <ExternalLink href={stripeDashboardUrl("payment", detail.paymentReference)}>{detail.paymentReference} · Open in Stripe</ExternalLink> : "Not provided" },
            ]} />
            <div>
              <h4 className="text-sm font-black text-slate-900">Redemption history</h4>
              {detail.redemptions.length === 0 ? <p className="mt-1 text-sm font-semibold text-slate-500">Not redeemed yet.</p> : (
                <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
                  {detail.redemptions.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <span className="font-bold">{formatMinor(r.amountMinor, r.currency)} credited to {r.redeemer.name || r.redeemer.email || r.redeemer.id}</span>
                      <span className="text-xs font-semibold text-slate-500">Balance after {formatMinor(r.balanceAfter, r.currency)} · {formatDateTime(r.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {canMutate && detail.status === "ACTIVE" ? <Button variant="ghost" onClick={() => ask(detail, "pause")}>Pause</Button> : null}
              {canMutate && detail.status === "PAUSED" ? <Button variant="secondary" onClick={() => ask(detail, "resume")}>Resume</Button> : null}
              {canMutate && ["ACTIVE", "PAUSED", "PENDING_PAYMENT"].includes(detail.status) ? <Button variant="danger" onClick={() => ask(detail, "cancel")}>Cancel gift card</Button> : null}
              <Button variant="ghost" className="ml-auto" onClick={() => setDetail(null)}>Close</Button>
            </div>
          </Card>
        </div>
      ) : null}
      {confirm.dialog}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

function GiftCardsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const perms = usePermissions();
  const { selectedCurrency } = useAdminDisplayCurrency("EUR");
  const tab = params.get("tab") === "purchased" ? "purchased" : "catalogue";

  if (!perms.loading && !perms.has("rewards.read")) return <NoAccess what="gift cards" />;
  const canMutate = perms.has("rewards.mutate");

  const setTab = (t: string) => router.replace(`${pathname}?tab=${t}`);
  return (
    <div className="space-y-5">
      <PageHeader title="Gift Cards" subtitle="The gift card catalogue and every card customers have purchased. Hot Deals have their own page." />
      <StatusTabs tabs={[{ key: "catalogue", label: "Catalogue" }, { key: "purchased", label: "Purchased cards" }]} active={tab} onChange={setTab} />
      {tab === "catalogue" ? <CatalogueTab canMutate={canMutate} display={selectedCurrency} /> : <PurchasedTab canMutate={canMutate} display={selectedCurrency} />}
    </div>
  );
}

export default function GiftCardsPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Suspense fallback={<LoadingPanel label="Loading gift cards…" />}>
          <GiftCardsInner />
        </Suspense>
      </AdminLayout>
    </ProtectedRoute>
  );
}
