"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import { Banner, StatusTabs, useConfirm } from "@/components/AdminKit";
import { NoAccess } from "@/components/PageStates";
import { APIError } from "@/lib/api";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { communicationsAPI, type ChannelStatus } from "@/lib/services/communications.api";
import ComposeFlow from "./ComposeFlow";
import HistoryTab from "./HistoryTab";
import ScheduledTab from "./ScheduledTab";
import TemplatesTab from "./TemplatesTab";

type Tab = "compose" | "history" | "scheduled" | "templates";

function CommunicationsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const perms = usePermissions();
  const canRead = perms.hasAny("communications.read", "communications.send");
  const canSend = perms.has("communications.send");
  const isSuper = !!perms.access?.isSuperAdmin || perms.has("admin.*");
  const userId = params.get("userId") ?? undefined;
  const requested = params.get("tab") as Tab | null;
  const tab: Tab = requested && ["compose", "history", "scheduled", "templates"].includes(requested) ? requested : userId ? "compose" : canSend ? "compose" : "history";

  const [status, setStatus] = useState<ChannelStatus | null>(null);
  const [error, setError] = useState("");
  const [historyKey, setHistoryKey] = useState(0);
  const confirm = useConfirm();

  const loadStatus = useCallback(async () => {
    try { setStatus(await communicationsAPI.channelStatus()); setError(""); }
    catch (e) { setError(e instanceof APIError ? e.message : "Could not load channel status."); }
  }, []);
  useEffect(() => { if (canRead) void loadStatus(); }, [canRead, loadStatus]);

  const setTab = (t: string) => {
    const q = new URLSearchParams(params.toString());
    q.set("tab", t);
    router.replace(`/communications?${q.toString()}`);
  };

  const togglePause = (which: "commsPaused" | "automationsPaused") => {
    if (!status) return;
    const now = which === "commsPaused" ? status.pause.commsPaused : status.pause.automationsPaused;
    const label = which === "commsPaused" ? "all outbound broadcasts and scheduled sends" : "automated messages (cart recovery, reminders, win-back…)";
    confirm.ask(
      {
        tone: now ? "primary" : "danger",
        title: now ? "Resume communications?" : "Pause communications?",
        description: now
          ? `This resumes ${label}.`
          : `This immediately stops ${label}. Order, payment and verification messages keep working. Requires 2FA.`,
        confirmLabel: now ? "Resume" : "Pause now",
        reasonLabel: "Reason (audit log)",
      },
      async (reason) => {
        const next = await communicationsAPI.pause.set({ [which]: !now, reason });
        setStatus((s) => (s ? { ...s, pause: next } : s));
      },
    );
  };

  if (perms.loading) return <LoadingPanel label="Checking your access…" />;
  if (!canRead) return <NoAccess what="Communications" />;

  const tabs = [
    ...(canSend ? [{ key: "compose", label: "New broadcast" }] : []),
    { key: "history", label: "History" },
    { key: "scheduled", label: "Scheduled" },
    { key: "templates", label: "Templates" },
  ];
  const paused = status?.pause;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communications"
        subtitle="Audience, channel, compose, test, confirm, deliver, measure. One governed flow for every broadcast."
        actions={isSuper && status ? (
          <>
            <Button variant={paused?.commsPaused ? "primary" : "danger"} onClick={() => togglePause("commsPaused")}>
              {paused?.commsPaused ? "Resume communications" : "Emergency pause"}
            </Button>
            <Button variant="ghost" onClick={() => togglePause("automationsPaused")}>
              {paused?.automationsPaused ? "Resume automations" : "Pause automations"}
            </Button>
          </>
        ) : undefined}
      />
      {paused?.commsPaused ? <Banner tone="danger" title="Outbound communications are paused">Broadcasts, scheduled sends and automated messages are stopped. Transactional order and payment messages are not affected.{isSuper ? "" : " A Super Administrator can resume them."}</Banner> : null}
      {paused?.automationsPaused && !paused.commsPaused ? <Banner tone="warning" title="Automations are paused">Automated messages are not being sent. Broadcasts still work.</Banner> : null}
      {status && !status.email.configured ? <Banner tone="warning" title="Email is not configured">{status.email.note} Email is disabled in the composer.</Banner> : null}
      {error ? <ErrorPanel message={error} onRetry={() => void loadStatus()} /> : null}

      <StatusTabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "compose" && canSend ? (
        <ComposeFlow status={status} canSend={canSend} initialUserId={userId} onSent={() => { setHistoryKey((k) => k + 1); void loadStatus(); }} />
      ) : null}
      {tab === "history" ? <HistoryTab key={historyKey} initialStatus={params.get("status") ?? ""} /> : null}
      {tab === "scheduled" ? <ScheduledTab canSend={canSend} paused={!!paused?.commsPaused} /> : null}
      {tab === "templates" ? <TemplatesTab canSend={canSend} /> : null}
      {confirm.dialog}
    </div>
  );
}

export default function CommunicationsPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Suspense fallback={<LoadingPanel label="Loading communications…" />}>
          <CommunicationsInner />
        </Suspense>
      </AdminLayout>
    </ProtectedRoute>
  );
}
