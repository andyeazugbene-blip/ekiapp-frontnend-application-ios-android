"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader, TextLink, TwoFactorModal } from "@/components/AdminUI";
import { Banner, DataTable, KeyValue, formatDateTime, formatMinor, useConfirm, type Column } from "@/components/AdminKit";
import { APIError } from "@/lib/api";
import { useTwoFactorAction } from "@/lib/hooks/useTwoFactorAction";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { disputeStatusLabel, disputesAPI2, type DisputeDetail } from "@/lib/services/money.api";
import DisputeCase from "./DisputeCase";

type Item = NonNullable<DisputeDetail["order"]>["items"][number];
type Decision = "buyer" | "vendor" | "partial";

const DECISION_LABEL: Record<Decision, { title: string; hint: string }> = {
  buyer: { title: "Refund the buyer in full", hint: "A real refund is sent through the payment provider first; the dispute only closes if it succeeds." },
  vendor: { title: "Release to the vendor", hint: "The order completes and the vendor's earnings are released." },
  partial: { title: "Partial refund", hint: "Refund part of the order; the rest is released to the vendor." },
};

export default function DisputeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const twoFactor = useTwoFactorAction();
  const confirm = useConfirm();
  const canMutate = usePermissions().has("disputes.mutate");
  const [d, setD] = useState<DisputeDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [decision, setDecision] = useState<Decision>("buyer");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [fraud, setFraud] = useState(false);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setLoading(true); setError(""); setD(await disputesAPI2.get(id)); }
    catch (e) { setError(e instanceof APIError ? e.message : "Failed to load dispute"); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  if (loading && !d) return <ProtectedRoute><AdminLayout><LoadingPanel label="Loading dispute…" /></AdminLayout></ProtectedRoute>;
  if (error || !d) return <ProtectedRoute><AdminLayout><ErrorPanel message={error || "Dispute not found"} onRetry={() => void load()} /></AdminLayout></ProtectedRoute>;

  // The form shows only while the dispute is genuinely OPEN (statuses are RESOLVED_*, not "RESOLVED").
  const isOpen = d.status === "OPEN";
  const cur = d.order?.currency ?? "EUR";

  const submit = async () => {
    setFormError("");
    if (note.trim().length < 10) { setFormError("Add a resolution note of at least 10 characters - both parties can see it."); return; }
    let refundAmountMinor: number | undefined;
    if (decision === "partial") {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) { setFormError("Enter the refund amount for a partial refund."); return; }
      refundAmountMinor = Math.round(n * 100);
      if (d.order && refundAmountMinor >= d.order.totalAmount) { setFormError("A partial refund must be less than the order total. Choose 'Refund the buyer in full' instead."); return; }
    }
    confirm.ask(
      {
        title: DECISION_LABEL[decision].title + "?",
        tone: decision === "vendor" ? "primary" : "danger",
        confirmLabel: "Resolve dispute",
        requireReason: false,
        description: (decision === "partial" && refundAmountMinor != null ? `Refund ${formatMinor(refundAmountMinor, cur)} to the buyer. ` : "") + DECISION_LABEL[decision].hint + " Both parties are notified and this cannot be undone.",
      },
      async () => {
        setBusy(true);
        try {
          await twoFactor.run(async (code) => {
            await disputesAPI2.resolve(id, { resolution: decision, note: note.trim(), refundAmountMinor, fraudulent: fraud }, code);
            setNote(""); setAmount(""); setFraud(false);
            await load();
          });
        } finally { setBusy(false); }
      },
    );
  };

  const itemCols: Column<Item>[] = [
    { key: "p", header: "Item", render: (i) => <span className="font-bold">{i.productTitle ?? "—"}</span> },
    { key: "q", header: "Qty", render: (i) => i.quantity },
    { key: "t", header: "Total", render: (i) => formatMinor(i.totalAmount, cur) },
  ];

  // What was actually decided is read from the status, never guessed from the free-text note.
  const decided = d.status === "RESOLVED_BUYER" ? "Buyer refunded" : d.status === "RESOLVED_VENDOR" ? "Released to vendor" : d.status === "RESOLVED_PARTIAL" ? "Partial refund" : null;

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <PageHeader
            title={`Dispute · ${d.order?.orderNumber ?? d.id}`}
            subtitle={d.reason}
            actions={
              <>
                <Button variant="ghost" onClick={() => router.push("/disputes")}>← All disputes</Button>
                {d.order ? <Button variant="secondary" onClick={() => router.push(`/orders/${d.order!.id}`)}>Open order</Button> : null}
              </>
            }
          />
          {twoFactor.error ? <Banner tone="danger">{twoFactor.error}</Banner> : null}
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={isOpen ? "red" : "green"}>{disputeStatusLabel[d.status]}</Badge>
            {d.fraudulent ? <Badge tone="amber">Flagged as fraudulent</Badge> : null}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <h3 className="mb-4 text-lg font-black text-[#101820]">Parties</h3>
              <KeyValue items={[
                { label: "Buyer", value: d.buyer ? <TextLink href={`/users/${d.buyer.id}`}>{d.buyer.name || d.buyer.email} →</TextLink> : "Not provided" },
                { label: "Buyer email", value: d.buyer?.email ?? "Not provided" },
                { label: "Vendor", value: d.vendor ? <TextLink href={`/vendors/${d.vendor.id}`}>{d.vendor.storeName} →</TextLink> : "Not provided" },
                { label: "Opened", value: formatDateTime(d.createdAt) },
                { label: "Order total", value: d.order ? formatMinor(d.order.totalAmount, cur) : "Not provided" },
                { label: "Delivery address", value: d.order?.deliveryAddress ?? "Not provided" },
              ]} />
            </Card>
            <Card>
              <h3 className="mb-3 text-lg font-black text-[#101820]">Items</h3>
              <DataTable columns={itemCols} rows={d.order?.items ?? []} rowKey={(i, ) => `${i.productTitle}-${i.totalAmount}`} emptyTitle="No items recorded" />
            </Card>
          </div>

          <DisputeCase d={d} reload={load} twoFactor={twoFactor} canMutate={canMutate} />

          {decided ? (
            <Card>
              <h3 className="mb-2 text-lg font-black text-[#101820]">Decision</h3>
              <Banner tone="success" title={decided}>
                {d.refundAmount ? `Refunded ${formatMinor(d.refundAmount, cur)}. ` : ""}
                {d.resolvedAt ? `Resolved ${formatDateTime(d.resolvedAt)}.` : ""}
              </Banner>
              {d.resolution ? <p className="mt-3 text-sm text-slate-700"><span className="font-bold">Note shared with both parties:</span> {d.resolution}</p> : null}
            </Card>
          ) : null}

          {isOpen && !canMutate ? <Banner tone="info">Your role can view this dispute but cannot message the parties or decide it.</Banner> : null}
          {isOpen && canMutate ? (
            <Card>
              <h3 className="mb-1 text-lg font-black text-[#101820]">Decide this dispute</h3>
              <p className="mb-4 text-sm text-slate-500">Requires 2FA. Both the buyer and the vendor are notified and the decision is written to the audit log.</p>
              <div className="grid gap-3 md:grid-cols-3">
                {(Object.keys(DECISION_LABEL) as Decision[]).map((k) => (
                  <button
                    key={k} onClick={() => setDecision(k)} aria-pressed={decision === k}
                    className={`rounded-2xl border p-4 text-left transition ${decision === k ? "border-[#096B4A] bg-emerald-50" : "border-slate-200 hover:bg-slate-50"}`}
                  >
                    <p className="font-black text-slate-900">{DECISION_LABEL[k].title}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{DECISION_LABEL[k].hint}</p>
                  </button>
                ))}
              </div>
              {decision === "partial" ? (
                <label className="mt-4 block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Refund amount ({cur.toUpperCase()})</span>
                  <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                    className="mt-1 h-11 w-full max-w-xs rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#096B4A]" />
                </label>
              ) : null}
              <label className="mt-4 block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Resolution note (shared with buyer and vendor)</span>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#096B4A]" />
              </label>
              <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={fraud} onChange={(e) => setFraud(e.target.checked)} className="h-4 w-4 accent-[#096B4A]" />
                Flag the buyer as fraudulent (lowers their trust score)
              </label>
              {formError ? <p className="mt-3 text-sm font-bold text-red-600">{formError}</p> : null}
              <div className="mt-4">
                <Button disabled={busy} onClick={() => void submit()}>{busy ? "Resolving…" : "Resolve dispute"}</Button>
              </div>
            </Card>
          ) : null}

          {confirm.dialog}
          <TwoFactorModal
            open={twoFactor.show2FAModal} code={twoFactor.code} onCodeChange={twoFactor.setCode}
            onSubmit={() => void twoFactor.submit2FA()} onCancel={twoFactor.cancel2FA} loading={twoFactor.loading} error={twoFactor.error}
          />
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
