"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { LoadingPanel, PageHeader } from "@/components/AdminUI";
import { StatusTabs } from "@/components/AdminKit";
import { NoAccess } from "@/components/PageStates";
import { usePermissions } from "@/lib/hooks/usePermissions";
import AutomationsTab from "./AutomationsTab";
import EventsTab from "./EventsTab";
import FailuresTab from "./FailuresTab";
import RunsTab from "./RunsTab";

type Tab = "automations" | "runs" | "failures" | "events";
const TABS: Tab[] = ["automations", "runs", "failures", "events"];

function AutomationInner() {
  const router = useRouter();
  const params = useSearchParams();
  const perms = usePermissions();
  const [version, setVersion] = useState(0);
  const requested = params.get("tab") as Tab | null;
  // Vendor deep link (/automation?vendorId=...) opens Run History for that vendor.
  const vendorId = params.get("vendorId") ?? undefined;
  const tab: Tab = requested && TABS.includes(requested) ? requested : vendorId ? "runs" : "automations";

  if (perms.loading) return <LoadingPanel label="Checking your access…" />;
  if (!perms.has("automation.read")) return <NoAccess what="Automation Centre" />;
  const canMutate = perms.has("automation.mutate");
  const isSuper = !!perms.access?.isSuperAdmin || perms.has("admin.*");

  const setTab = (t: string) => {
    const q = new URLSearchParams(params.toString());
    q.set("tab", t);
    router.replace(`/automation?${q.toString()}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Automation Centre" subtitle="What Eki sends automatically, to whom, why it did or did not send, and what happened next." />
      <StatusTabs
        tabs={[{ key: "automations", label: "Automations" }, { key: "runs", label: "Run History" }, { key: "failures", label: "Failures" }, { key: "events", label: "Events" }]}
        active={tab}
        onChange={setTab}
      />
      {tab === "automations" ? <AutomationsTab key={version} canMutate={canMutate} isSuper={isSuper} onChanged={() => undefined} /> : null}
      {tab === "runs" ? (
        <RunsTab
          key={`${version}-${params.get("ruleKey") ?? ""}-${params.get("status") ?? ""}-${params.get("reason") ?? ""}-${vendorId ?? ""}`}
          canMutate={canMutate}
          initial={{ vendorId, ruleKey: params.get("ruleKey") ?? undefined, status: params.get("status") ?? undefined, type: params.get("type") ?? undefined }}
        />
      ) : null}
      {tab === "failures" ? <FailuresTab key={version} canMutate={canMutate} /> : null}
      {tab === "events" ? <EventsTab /> : null}
    </div>
  );
}

export default function AutomationPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Suspense fallback={<LoadingPanel label="Loading Automation Centre…" />}>
          <AutomationInner />
        </Suspense>
      </AdminLayout>
    </ProtectedRoute>
  );
}
