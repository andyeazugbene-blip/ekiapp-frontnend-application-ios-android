"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, ErrorPanel, LoadingPanel } from "@/components/AdminUI";
import { FilterSelect, Pagination, StatusTabs, formatDateTime, useConfirm } from "@/components/AdminKit";
import { APIError } from "@/lib/api";
import { contentReviewAPI, type ReviewReport } from "@/lib/services/content-review.api";

const REASON_LABEL: Record<string, string> = { inappropriate: "Inappropriate", spam: "Spam", harassment: "Harassment", fraud: "Fraud", other: "Other" };
const TYPE_LABEL: Record<string, string> = { review: "Review", message: "Message", product: "Product", store: "Store" };
const STATUS_TABS = [
  { key: "PENDING", label: "Pending" },
  { key: "REVIEWED", label: "Reviewed" },
  { key: "DISMISSED", label: "Dismissed" },
  { key: "", label: "All" },
];

export default function ReportsTab({ canMutate, onChanged }: { canMutate: boolean; onChanged: () => void }) {
  const [status, setStatus] = useState("PENDING");
  const [type, setType] = useState("");
  const [items, setItems] = useState<ReviewReport[]>([]);
  const [cursors, setCursors] = useState<string[]>([""]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const confirm = useConfirm();

  const load = useCallback(async (cursor: string) => {
    setLoading(true); setError("");
    try {
      const r = await contentReviewAPI.reports({ status: status || undefined, targetType: type || undefined, cursor: cursor || undefined, limit: 15 });
      setItems(r.reports); setNext(r.nextCursor);
    } catch (e) { setError(e instanceof APIError ? e.message : "Could not load reports."); }
    finally { setLoading(false); }
  }, [status, type]);

  useEffect(() => { setCursors([""]); void load(""); }, [load]);

  const act = (r: ReviewReport, decision: "REVIEWED" | "DISMISSED") =>
    confirm.ask(
      {
        tone: "primary",
        title: decision === "REVIEWED" ? "Mark report as reviewed?" : "Dismiss this report?",
        description: `${REASON_LABEL[r.reason] ?? r.reason} report on ${TYPE_LABEL[r.targetType] ?? r.targetType}${r.targetLabel ? `: ${r.targetLabel}` : ""}.`,
        confirmLabel: decision === "REVIEWED" ? "Mark reviewed" : "Dismiss report",
        reasonLabel: "Decision reason (stored on the report and in the audit log)",
      },
      async (reason) => { await contentReviewAPI.reviewReport(r.id, decision, reason); await load(cursors[cursors.length - 1]); onChanged(); },
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusTabs tabs={STATUS_TABS} active={status} onChange={setStatus} />
        <FilterSelect label="Reported item type" value={type} onChange={setType} options={[{ value: "", label: "All item types" }, ...Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))]} />
      </div>
      {error ? <ErrorPanel message={error} onRetry={() => void load(cursors[cursors.length - 1])} /> : null}
      {loading && items.length === 0 ? <LoadingPanel label="Loading reports…" /> : items.length === 0 ? (
        <Card><p className="py-6 text-center text-sm font-semibold text-slate-500">No {status ? status.toLowerCase() + " " : ""}reports.</p></Card>
      ) : (
        <div className={`space-y-3 ${loading ? "opacity-60" : ""}`}>
          {items.map((r) => (
            <Card key={r.id} className="!p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-[#101820]">{REASON_LABEL[r.reason] ?? r.reason}</p>
                    <Badge tone={r.status === "PENDING" ? "amber" : r.status === "DISMISSED" ? "gray" : "green"}>{r.status === "PENDING" ? "Pending" : r.status === "DISMISSED" ? "Dismissed" : "Reviewed"}</Badge>
                    <Badge tone="blue">{TYPE_LABEL[r.targetType] ?? r.targetType}</Badge>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{r.targetLabel ?? `${TYPE_LABEL[r.targetType] ?? r.targetType} (${r.targetId.slice(0, 10)}…)`}</p>
                  <p className="text-sm text-slate-600">Reported by {r.reporter ? `${r.reporter.name} (${r.reporter.email})` : "a deleted account"} · {formatDateTime(r.createdAt)}</p>
                  {r.details ? <p className="max-w-xl rounded-lg bg-slate-50 p-2 text-sm text-slate-700">{r.details}</p> : null}
                  {r.status !== "PENDING" ? (
                    <p className="text-sm text-slate-600">
                      {r.status === "DISMISSED" ? "Dismissed" : "Reviewed"} by <strong>{r.reviewer?.name ?? "Not provided"}</strong> · {formatDateTime(r.reviewedAt)}
                      {r.decisionReason ? <> · Reason: <em>{r.decisionReason}</em></> : null}
                    </p>
                  ) : null}
                </div>
                {r.status === "PENDING" && canMutate ? (
                  <div className="flex shrink-0 gap-2">
                    <Button variant="secondary" className="h-9 px-3" onClick={() => act(r, "REVIEWED")}>Mark reviewed</Button>
                    <Button variant="ghost" className="h-9 px-3" onClick={() => act(r, "DISMISSED")}>Dismiss</Button>
                  </div>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
      <Pagination
        hasPrev={cursors.length > 1} hasNext={!!next} loading={loading} shown={items.length}
        onPrev={() => { const c = cursors.slice(0, -1); setCursors(c); void load(c[c.length - 1]); }}
        onNext={() => { if (next) { setCursors([...cursors, next]); void load(next); } }}
      />
      {confirm.dialog}
    </div>
  );
}
