"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, ErrorPanel, LoadingPanel } from "@/components/AdminUI";
import { Banner, formatDateTime, KeyValue } from "@/components/AdminKit";
import { APIError } from "@/lib/api";
import { IntegrationStatus, platformSettingsAPI, SystemInfo } from "@/lib/services/security.api";

/** Read-only, truthful status derived from whether server configuration is present. Never shows secrets. */
export default function IntegrationsTab({ view }: { view: "integrations" | "system" }) {
  const [data, setData] = useState<{ integrations: IntegrationStatus[]; system: SystemInfo } | null>(null);
  const [error, setError] = useState("");
  const [apiOk, setApiOk] = useState<"checking" | "ok" | "down">("checking");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await platformSettingsAPI.integrations());
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Could not load status.");
    }
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`);
      setApiOk(res.ok ? "ok" : "down");
    } catch {
      setApiOk("down");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <ErrorPanel message={error} onRetry={() => void load()} />;
  if (!data) return <LoadingPanel label="Checking configuration..." />;

  if (view === "system") {
    const s = data.system;
    return (
      <Card>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-black">System</h2>
          <Button variant="ghost" onClick={() => void load()}>Refresh</Button>
        </div>
        <div className="mt-4">
          <KeyValue
            items={[
              { label: "API status", value: apiOk === "checking" ? "Checking..." : apiOk === "ok" ? <Badge tone="green">Reachable</Badge> : <Badge tone="red">Not reachable</Badge> },
              { label: "Backend version", value: s.version },
              { label: "Environment", value: s.environment },
              { label: "Build commit", value: s.commit ?? "Not available" },
              { label: "Node runtime", value: s.nodeVersion },
              { label: "Backend started", value: formatDateTime(s.startedAt) },
              { label: "Mandatory admin 2FA", value: s.admin2faEnforced ? "Enforced" : "Not enforced (ADMIN_2FA_ENFORCE off)" },
              { label: "Admin panel API URL", value: process.env.NEXT_PUBLIC_API_URL ?? "Default" },
            ]}
          />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Banner tone="info">Shows whether each integration is configured on the server, based on environment settings only. It does not test live connectivity and never reveals keys.</Banner>
      <div className="grid gap-4 md:grid-cols-2">
        {data.integrations.map((i) => (
          <Card key={i.key}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-black">{i.label}</h3>
              {i.configured ? <Badge tone="green">Configured</Badge> : <Badge tone="amber">Not configured</Badge>}
            </div>
            <p className="mt-1 text-sm text-slate-600">{i.detail}</p>
            {i.checks.length ? (
              <ul className="mt-3 space-y-1 text-sm">
                {i.checks.map((c) => (
                  <li key={c.label} className="flex items-center gap-2">
                    <span className={c.ok ? "text-emerald-600" : "text-amber-600"} aria-hidden="true">{c.ok ? "✓" : "✗"}</span>
                    <span>{c.label}: {c.ok ? "set" : "missing"}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
