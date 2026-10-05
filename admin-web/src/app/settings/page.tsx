"use client";

import { Suspense, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { PageHeader } from "@/components/AdminUI";
import { NoAccess } from "@/components/PageStates";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/lib/hooks/usePermissions";
import FlagsTab from "./_tabs/FlagsTab";
import IntegrationsTab from "./_tabs/IntegrationsTab";
import RolesTab from "./_tabs/RolesTab";
import SecurityTab from "./_tabs/SecurityTab";
import TeamTab from "./_tabs/TeamTab";
import ThresholdsTab from "./_tabs/ThresholdsTab";

type TabKey = "team" | "roles" | "security" | "thresholds" | "flags" | "integrations" | "system";

const TABS: { key: TabKey; label: string; needs?: string }[] = [
  { key: "team", label: "Team", needs: "roles.read" },
  { key: "roles", label: "Roles & permissions", needs: "roles.read" },
  { key: "security", label: "Security" },
  { key: "thresholds", label: "Operational thresholds", needs: "settings.read" },
  { key: "flags", label: "Platform flags", needs: "settings.read" },
  { key: "integrations", label: "Integrations", needs: "settings.read" },
  { key: "system", label: "System", needs: "settings.read" },
];

function SettingsInner() {
  const { user } = useAuth();
  const { has, loading } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const visible = useMemo(() => TABS.filter((t) => !t.needs || has(t.needs)), [has]);
  const requested = params.get("tab") as TabKey | null;
  const active: TabKey | undefined = visible.find((t) => t.key === requested)?.key ?? visible[0]?.key;

  function select(key: TabKey) {
    router.replace(`${pathname}?tab=${key}`, { scroll: false });
  }

  if (!loading && !active) return <NoAccess what="Settings" />;

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" subtitle="Team, roles, security, platform configuration and integration status." />
      <div className="flex flex-wrap gap-x-8 gap-y-2 border-b border-slate-200" role="tablist" aria-label="Settings sections">
        {visible.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={active === t.key}
            onClick={() => select(t.key)}
            className={`border-b-2 px-1 pb-4 text-base font-bold ${active === t.key ? "border-[#096B4A] text-[#096B4A]" : "border-transparent text-slate-600 hover:text-slate-900"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === "team" ? <TeamTab currentAdminId={user?.id} /> : null}
      {active === "roles" ? <RolesTab /> : null}
      {active === "security" ? <SecurityTab /> : null}
      {active === "thresholds" ? <ThresholdsTab currentAdminId={user?.id} /> : null}
      {active === "flags" ? <FlagsTab /> : null}
      {active === "integrations" ? <IntegrationsTab view="integrations" /> : null}
      {active === "system" ? <IntegrationsTab view="system" /> : null}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Suspense fallback={null}>
          <SettingsInner />
        </Suspense>
      </AdminLayout>
    </ProtectedRoute>
  );
}
