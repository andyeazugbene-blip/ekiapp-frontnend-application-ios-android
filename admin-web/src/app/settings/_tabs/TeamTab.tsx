"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, ErrorPanel, LoadingPanel } from "@/components/AdminUI";
import { Banner, DataTable, formatDateTime, useConfirm, type Column } from "@/components/AdminKit";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { APIError } from "@/lib/api";
import { AdminRoleRecord, rolesAPI } from "@/lib/services/roles.api";
import { AdminAccount, adminTeamAPI } from "@/lib/services/security.api";

const statusTone = { ACTIVE: "green", INVITED: "amber", DEACTIVATED: "gray" } as const;

export default function TeamTab({ currentAdminId }: { currentAdminId?: string }) {
  const { has } = usePermissions();
  const canManage = has("roles.mutate");
  const confirm = useConfirm();
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [roles, setRoles] = useState<AdminRoleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "info"; text: string } | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ name: "", email: "", roleId: "" });
  const [roleEdit, setRoleEdit] = useState<{ admin: AdminAccount; roleId: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [a, r] = await Promise.all([adminTeamAPI.list(), rolesAPI.list()]);
      setAdmins(a);
      setRoles(r.roles);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Could not load the admin team.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: Column<AdminAccount>[] = [
    {
      key: "name",
      header: "Administrator",
      render: (a) => (
        <div>
          <p className="font-bold text-[#101820]">{a.name}{a.id === currentAdminId ? <span className="ml-2 text-xs font-semibold text-slate-400">(you)</span> : null}</p>
          <p className="text-xs text-slate-500">{a.email}</p>
        </div>
      ),
    },
    { key: "role", header: "Role", render: (a) => (a.roles.length ? a.roles.map((r) => r.name).join(", ") : <span className="text-amber-700">No role (no access)</span>) },
    { key: "status", header: "Status", render: (a) => <Badge tone={statusTone[a.status]}>{a.status === "INVITED" ? "Invited" : a.status === "ACTIVE" ? "Active" : "Deactivated"}</Badge> },
    { key: "2fa", header: "2FA", render: (a) => (a.twoFactorEnabled ? <Badge tone="green">Enabled</Badge> : <Badge tone="amber">Not set up</Badge>) },
    { key: "last", header: "Last recorded action", render: (a) => (a.lastActivityAt ? formatDateTime(a.lastActivityAt) : "Not recorded") },
    {
      key: "actions",
      header: "",
      render: (a) =>
        canManage && a.id !== currentAdminId ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" className="h-9 px-3" onClick={() => setRoleEdit({ admin: a, roleId: a.roles[0]?.id ?? "" })}>Change role</Button>
            {a.status === "DEACTIVATED" ? (
              <Button
                variant="ghost"
                className="h-9 px-3"
                onClick={() =>
                  confirm.ask({ title: `Reactivate ${a.name}?`, description: "They will be able to sign in again with their existing password.", confirmLabel: "Reactivate", tone: "primary" }, async (reason) => {
                    await adminTeamAPI.reactivate(a.id, reason);
                    setNotice({ tone: "success", text: `${a.name} reactivated.` });
                    await load();
                  })
                }
              >
                Reactivate
              </Button>
            ) : (
              <Button
                variant="danger"
                className="h-9 px-3"
                onClick={() =>
                  confirm.ask({ title: `Deactivate ${a.name}?`, description: "They are signed out everywhere immediately and cannot sign in until reactivated.", confirmLabel: "Deactivate" }, async (reason) => {
                    await adminTeamAPI.deactivate(a.id, reason);
                    setNotice({ tone: "success", text: `${a.name} deactivated.` });
                    await load();
                  })
                }
              >
                Deactivate
              </Button>
            )}
          </div>
        ) : null,
    },
  ];

  if (loading) return <LoadingPanel label="Loading the admin team..." />;
  if (error) return <ErrorPanel message={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-5">
      {notice ? <Banner tone={notice.tone}>{notice.text}</Banner> : null}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Team</h2>
            <p className="mt-1 text-sm text-slate-500">Everyone with access to this admin panel. Changes are audited with your reason and need a 2FA code.</p>
          </div>
          {canManage ? <Button onClick={() => setInviteOpen(true)}>Invite administrator</Button> : null}
        </div>
        <div className="mt-5">
          <DataTable columns={columns} rows={admins} rowKey={(a) => a.id} emptyTitle="No administrators found" />
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Last recorded action is the latest entry in the audit log by this person. There is no device/session table, so live sessions cannot be listed.
        </p>
      </Card>

      {inviteOpen ? (
        <InviteDialog
          roles={roles}
          value={invite}
          onChange={setInvite}
          onCancel={() => setInviteOpen(false)}
          onDone={async (message) => {
            setInviteOpen(false);
            setInvite({ name: "", email: "", roleId: "" });
            setNotice({ tone: "success", text: message });
            await load();
          }}
        />
      ) : null}

      {roleEdit
        ? (() => {
            const target = roleEdit;
            return (
              <RoleDialog
                admin={target.admin}
                roles={roles}
                roleId={target.roleId}
                onChange={(roleId) => setRoleEdit({ ...target, roleId })}
                onCancel={() => setRoleEdit(null)}
                onDone={async () => {
                  setRoleEdit(null);
                  setNotice({ tone: "success", text: `${target.admin.name}'s role was updated.` });
                  await load();
                }}
              />
            );
          })()
        : null}
      {confirm.dialog}
    </div>
  );
}

function Modal({ title, children, onCancel }: { title: string; children: React.ReactNode; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label={title} onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      <Card className="w-full max-w-lg">
        <h3 className="text-xl font-black text-[#101820]">{title}</h3>
        {children}
      </Card>
    </div>
  );
}

const inputCls = "mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-[#096B4A]";

function InviteDialog({
  roles, value, onChange, onCancel, onDone,
}: {
  roles: AdminRoleRecord[];
  value: { name: string; email: string; roleId: string };
  onChange: (v: { name: string; email: string; roleId: string }) => void;
  onCancel: () => void;
  onDone: (message: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const valid = value.name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email) && value.roleId && reason.trim().length >= 5;

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const res = await adminTeamAPI.invite({ ...value, email: value.email.trim(), name: value.name.trim(), reason: reason.trim() });
      await onDone(
        res.setPasswordUrl
          ? `Invitation created for ${res.admin.email}. Non-production link: ${res.setPasswordUrl}`
          : `Invitation emailed to ${res.admin.email}. The link expires in 72 hours.`,
      );
    } catch (err) {
      setError(err instanceof APIError ? err.message : err instanceof Error ? err.message : "Could not send the invitation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Invite administrator" onCancel={onCancel}>
      <p className="mt-1 text-sm text-slate-600">They receive a one-time link to set their password, then must set up two-factor authentication.</p>
      <div className="mt-4 space-y-3">
        <label className="block text-sm font-bold">Full name
          <input className={inputCls} value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} autoFocus />
        </label>
        <label className="block text-sm font-bold">Email
          <input type="email" className={inputCls} value={value.email} onChange={(e) => onChange({ ...value, email: e.target.value })} />
        </label>
        <label className="block text-sm font-bold">Role
          <select className={inputCls} value={value.roleId} onChange={(e) => onChange({ ...value, roleId: e.target.value })}>
            <option value="">Choose a role</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <label className="block text-sm font-bold">Reason (recorded in the audit log)
          <textarea className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#096B4A]" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="At least 5 characters" />
        </label>
      </div>
      {error ? <div className="mt-3"><Banner tone="danger">{error}</Banner></div> : null}
      <div className="mt-5 flex gap-3">
        <Button className="flex-1" disabled={!valid || busy} onClick={() => void submit()}>{busy ? "Sending..." : "Send invitation"}</Button>
        <Button className="flex-1" variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
      </div>
    </Modal>
  );
}

function RoleDialog({
  admin, roles, roleId, onChange, onCancel, onDone,
}: {
  admin: AdminAccount;
  roles: AdminRoleRecord[];
  roleId: string;
  onChange: (roleId: string) => void;
  onCancel: () => void;
  onDone: () => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = roles.find((r) => r.id === roleId);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await adminTeamAPI.changeRole(admin.id, roleId, reason.trim());
      await onDone();
    } catch (err) {
      setError(err instanceof APIError ? err.message : err instanceof Error ? err.message : "Could not change the role.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Change role for ${admin.name}`} onCancel={onCancel}>
      <div className="mt-4 space-y-3">
        <label className="block text-sm font-bold">New role
          <select className={inputCls} value={roleId} onChange={(e) => onChange(e.target.value)}>
            <option value="">Choose a role</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        {selected ? <p className="text-xs text-slate-500">{selected.description ?? `${selected.permissions.length} permissions`}</p> : null}
        <label className="block text-sm font-bold">Reason (recorded in the audit log)
          <textarea className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#096B4A]" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="At least 5 characters" />
        </label>
      </div>
      {error ? <div className="mt-3"><Banner tone="danger">{error}</Banner></div> : null}
      <div className="mt-5 flex gap-3">
        <Button className="flex-1" disabled={!roleId || reason.trim().length < 5 || busy} onClick={() => void submit()}>{busy ? "Saving..." : "Change role"}</Button>
        <Button className="flex-1" variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
      </div>
    </Modal>
  );
}
