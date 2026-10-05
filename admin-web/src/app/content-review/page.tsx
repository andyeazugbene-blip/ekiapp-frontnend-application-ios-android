"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import { Banner, FilterSelect, Pagination, SearchInput, StatusTabs, formatDateTime, useConfirm } from "@/components/AdminKit";
import { NoAccess } from "@/components/PageStates";
import { APIError } from "@/lib/api";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  contentReviewAPI,
  type ContentDecisionRow,
  type ModerationAction,
  type ModerationStatus,
  type ReviewAsset,
  type ReviewCounts,
  type ReviewReport,
  type ReviewTab,
} from "@/lib/services/content-review.api";
import ReportsTab from "./ReportsTab";

type TabKey = ReviewTab | "reports" | "identity";

const MODERATION_LABEL: Record<ModerationStatus, string> = {
  NOT_REVIEWED: "Not reviewed", PENDING_REVIEW: "Pending review", APPROVED: "Approved", REJECTED: "Rejected", REMOVED: "Removed",
};
const MODERATION_TONE: Record<ModerationStatus, "green" | "amber" | "red" | "blue" | "gray"> = {
  NOT_REVIEWED: "gray", PENDING_REVIEW: "amber", APPROVED: "green", REJECTED: "red", REMOVED: "red",
};
const TRANSFER_LABEL = { COMPLETED: "Upload successful", FAILED: "Upload failed", REQUESTED: "Transfer not completed" } as const;
const ACTION_LABEL: Record<ModerationAction, string> = { approve: "Approve", reject: "Reject", remove: "Remove", flag: "Flag for review", contact_owner: "Contact owner" };
const ACTION_HELP: Record<ModerationAction, string> = {
  approve: "Marks the content as acceptable.",
  reject: "Marks the content as not acceptable and notifies the owner.",
  remove: "Takes the content down (detaches it from the profile, store or product) and notifies the owner. The file is kept as evidence.",
  flag: "Sends the content back to the review queue.",
  contact_owner: "Sends the owner an in-app message. The moderation status does not change.",
};
const CATEGORY_OPTIONS = [
  { value: "", label: "All content types" }, { value: "product", label: "Product images" }, { value: "avatar", label: "Profile photos" },
  { value: "cover", label: "Store covers" }, { value: "message", label: "Message attachments" },
];
const EMPTY: Record<ReviewTab, string> = {
  flagged: "Nothing is waiting for review. Flagged content appears here.",
  failed: "No failed uploads.",
  suspicious: "No suspicious uploads (oversized files or unexpected file types).",
  reported: "No content linked to open user reports.",
  history: "No moderation decisions yet.",
};

function Inner() {
  const router = useRouter();
  const params = useSearchParams();
  const perms = usePermissions();
  const canContent = perms.hasAny("content.read", "content.mutate");
  const canReports = perms.hasAny("content.read", "reports.read");
  const canMutate = perms.hasAny("content.mutate", "reports.mutate");
  const canIdentity = perms.has("verification.read");
  const requested = params.get("tab") as TabKey | null;
  const defaultTab: TabKey = canContent ? "flagged" : canReports ? "reports" : "identity";
  const tab: TabKey = requested ?? defaultTab;

  const [counts, setCounts] = useState<ReviewCounts | null>(null);
  const loadCounts = useCallback(() => { contentReviewAPI.counts().then(setCounts).catch(() => undefined); }, []);
  useEffect(() => { if (canReports || canContent) loadCounts(); }, [canReports, canContent, loadCounts]);

  const setTab = (t: string) => router.replace(`/content-review?tab=${t}`);

  if (perms.loading) return <LoadingPanel label="Checking your access…" />;
  if (!canContent && !canReports && !canIdentity) return <NoAccess what="Content Review" />;

  const tabs = [
    ...(canContent ? (["flagged", "failed", "suspicious", "reported"] as ReviewTab[]).map((k) => ({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1), count: counts ? counts[k] : null })) : []),
    ...(canReports ? [{ key: "reports", label: "User reports", count: counts?.reports ?? null }] : []),
    ...(canContent ? [{ key: "history", label: "Decisions", count: counts?.history ?? null }] : []),
    ...(canIdentity ? [{ key: "identity", label: "Identity documents", count: null }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Review"
        subtitle="Only content that needs a decision: flagged, reported, suspicious or failed. Routine successful uploads are not queued."
      />
      <StatusTabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === "reports" ? <ReportsTab canMutate={canMutate} onChanged={loadCounts} /> : null}
      {tab === "identity" ? (canIdentity ? <AssetList key="identity" mode="identity" canMutate={false} onChanged={loadCounts} /> : <NoAccess what="identity documents" />) : null}
      {(["flagged", "failed", "suspicious", "reported", "history"] as ReviewTab[]).includes(tab as ReviewTab)
        ? (canContent ? <AssetList key={tab} mode={tab as ReviewTab} canMutate={perms.has("content.mutate")} onChanged={loadCounts} /> : <NoAccess what="content moderation" />)
        : null}
    </div>
  );
}

function AssetList({ mode, canMutate, onChanged }: { mode: ReviewTab | "identity"; canMutate: boolean; onChanged: () => void }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<ReviewAsset[]>([]);
  const [cursors, setCursors] = useState<string[]>([""]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [details, setDetails] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const confirm = useConfirm();

  const load = useCallback(async (cursor: string) => {
    setLoading(true); setError("");
    try {
      const r = mode === "identity"
        ? await contentReviewAPI.identity({ q: q || undefined, cursor: cursor || undefined, limit: 12 })
        : await contentReviewAPI.queue({ tab: mode, q: q || undefined, category: category || undefined, cursor: cursor || undefined, limit: 12 });
      setItems(r.items); setNext(r.nextCursor);
    } catch (e) { setError(e instanceof APIError ? e.message : "Could not load the queue."); }
    finally { setLoading(false); }
  }, [mode, q, category]);

  useEffect(() => { setCursors([""]); void load(""); }, [load]);

  const openSecurely = async (a: ReviewAsset) => {
    setNotice("");
    try {
      const r = await contentReviewAPI.readUrl(a.id);
      window.open(r.readUrl, "_blank", "noopener,noreferrer");
      setNotice(`Opened ${a.owner.name ?? "this upload"}. The link expires in ${Math.round(r.expiresInSeconds / 60)} minutes and this access was recorded in the audit log.`);
    } catch (e) { setError(e instanceof APIError ? e.message : "Could not open this upload."); }
  };

  const act = (a: ReviewAsset, action: ModerationAction) =>
    confirm.ask(
      {
        tone: action === "remove" || action === "reject" ? "danger" : "primary",
        title: `${ACTION_LABEL[action]}: ${a.owner.storeName ?? a.owner.name ?? "this upload"}?`,
        description: ACTION_HELP[action],
        confirmLabel: ACTION_LABEL[action],
        reasonLabel: action === "reject" || action === "remove" || action === "contact_owner" ? "Reason (shown to the owner and stored in the audit log)" : "Reason (audit log)",
      },
      async (reason) => { await contentReviewAPI.decide(a.id, action, reason); await load(cursors[cursors.length - 1]); onChanged(); },
    );

  return (
    <div className="space-y-4">
      {mode === "identity" ? (
        <Banner tone="warning" title="Identity documents are private">They are never previewed here. Each opening generates a short-lived link and is recorded in the audit log. Approve or reject identity in Verification.</Banner>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search owner name, email or store" />
        {mode !== "identity" ? <FilterSelect label="Content type" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} /> : null}
      </div>
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <ErrorPanel message={error} onRetry={() => void load(cursors[cursors.length - 1])} /> : null}
      {loading && items.length === 0 ? <LoadingPanel label="Loading…" /> : items.length === 0 ? (
        <Card><p className="py-8 text-center text-sm font-semibold text-slate-500">{mode === "identity" ? "No identity documents found." : EMPTY[mode]}</p></Card>
      ) : (
        <div className={`grid gap-4 lg:grid-cols-2 ${loading ? "opacity-60" : ""}`}>
          {items.map((a) => (
            <Card key={a.id} className="!p-4">
              <div className="flex gap-4">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-500">
                  {a.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.previewUrl} alt={`Upload by ${a.owner.name ?? "owner"}`} className="h-full w-full object-cover" />
                  ) : a.moderationStatus === "REMOVED" ? "Removed" : a.transferStatus !== "COMPLETED" ? "No file" : "No inline preview"}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-lg font-black text-[#101820]">{a.owner.storeName ?? a.owner.name ?? "Unknown owner"}</p>
                  <p className="truncate text-sm text-slate-600">{a.owner.storeName && a.owner.name ? `${a.owner.name} · ` : ""}{a.owner.email ?? "No email"}</p>
                  <p className="truncate text-sm font-semibold text-slate-800">{a.related?.label ?? `${a.category} upload`}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Badge tone={a.transferStatus === "COMPLETED" ? "green" : a.transferStatus === "FAILED" ? "red" : "amber"}>{TRANSFER_LABEL[a.transferStatus]}</Badge>
                    {mode !== "identity" ? <Badge tone={MODERATION_TONE[a.moderationStatus]}>{MODERATION_LABEL[a.moderationStatus]}</Badge> : null}
                    <Badge tone="gray">{a.category}</Badge>
                  </div>
                  <p className="text-xs text-slate-500">Uploaded {formatDateTime(a.createdAt)} · {a.contentType}{a.sizeBytes ? ` · ${(a.sizeBytes / 1024).toFixed(0)} KB` : ""}</p>
                  {a.lastDecision ? <p className="text-xs text-slate-600">Last decision: <strong>{a.lastDecision.action?.replace("_", " ") ?? MODERATION_LABEL[a.lastDecision.decision]}</strong> by {a.lastDecision.reviewer ?? "Not provided"} · “{a.lastDecision.reason}”</p> : null}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {a.transferStatus === "COMPLETED" && a.moderationStatus !== "REMOVED" && (mode === "identity" || !a.previewUrl) ? (
                  <Button variant="ghost" className="h-9 px-3" onClick={() => void openSecurely(a)}>{mode === "identity" ? "Open document securely" : "Open securely"}</Button>
                ) : null}
                {mode !== "identity" ? <Button variant="ghost" className="h-9 px-3" onClick={() => setDetails(a.id)}>Details and history</Button> : null}
                {mode !== "identity" && canMutate ? a.allowedActions.map((act1) => (
                  <Button key={act1} variant={act1 === "remove" || act1 === "reject" ? "danger" : act1 === "approve" ? "primary" : "secondary"} className="h-9 px-3" onClick={() => act(a, act1)}>{ACTION_LABEL[act1]}</Button>
                )) : null}
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
      {details ? <DetailDrawer id={details} onClose={() => setDetails(null)} /> : null}
      {confirm.dialog}
    </div>
  );
}

function DetailDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<{ asset: ReviewAsset; decisions: ContentDecisionRow[]; reports: ReviewReport[] } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { contentReviewAPI.asset(id).then(setData).catch((e) => setError(e instanceof APIError ? e.message : "Could not load details.")); }, [id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/40" role="dialog" aria-modal="true" aria-label="Upload details" onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-2xl font-black text-[#101820]">{data?.asset.owner.storeName ?? data?.asset.owner.name ?? "Upload"}</h2>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
        {error ? <div className="mt-4"><ErrorPanel message={error} /></div> : null}
        {!data && !error ? <div className="mt-6"><LoadingPanel label="Loading…" /></div> : null}
        {data ? (
          <div className="mt-5 space-y-5">
            {data.asset.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.asset.previewUrl} alt="Upload preview" className="max-h-72 w-full rounded-xl border border-slate-200 object-contain" />
            ) : null}
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs font-black uppercase text-slate-500">Owner</dt><dd className="font-semibold">{data.asset.owner.name ?? "Not provided"}<br /><span className="text-slate-500">{data.asset.owner.email}</span></dd></div>
              <div><dt className="text-xs font-black uppercase text-slate-500">Related to</dt><dd className="font-semibold">{data.asset.related?.label ?? "Unknown"}</dd></div>
              <div><dt className="text-xs font-black uppercase text-slate-500">Transfer</dt><dd className="font-semibold">{TRANSFER_LABEL[data.asset.transferStatus]}</dd></div>
              <div><dt className="text-xs font-black uppercase text-slate-500">Moderation</dt><dd className="font-semibold">{MODERATION_LABEL[data.asset.moderationStatus]}</dd></div>
            </dl>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Decision history</h3>
              {data.decisions.length === 0 ? <p className="mt-2 text-sm text-slate-500">No decisions yet.</p> : (
                <ol className="mt-2 space-y-2">
                  {data.decisions.map((d) => (
                    <li key={d.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                      <p className="font-black">{(d.action ?? "decision").replace("_", " ")} → {MODERATION_LABEL[d.decision]}</p>
                      <p className="text-slate-600">{d.reviewer ?? "Not provided"} · {formatDateTime(d.createdAt)}</p>
                      <p className="mt-1 text-slate-800">“{d.reason}”</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">User reports on the related item</h3>
              {data.reports.length === 0 ? <p className="mt-2 text-sm text-slate-500">None.</p> : (
                <ul className="mt-2 space-y-2">
                  {data.reports.map((r) => (
                    <li key={r.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                      <p className="font-bold">{r.reason} · {r.status.toLowerCase()}</p>
                      {r.details ? <p className="text-slate-600">{r.details}</p> : null}
                      <p className="text-xs text-slate-500">{formatDateTime(r.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ContentReviewPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Suspense fallback={<LoadingPanel label="Loading content review…" />}>
          <Inner />
        </Suspense>
      </AdminLayout>
    </ProtectedRoute>
  );
}
