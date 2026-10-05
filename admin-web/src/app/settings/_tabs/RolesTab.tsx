"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, ErrorPanel, Icon, LoadingPanel } from "@/components/AdminUI";
import { Banner, useConfirm } from "@/components/AdminKit";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { APIError } from "@/lib/api";
import { AdminRoleRecord, rolesAPI } from "@/lib/services/roles.api";

const inputCls = "mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-[#096B4A]";

/** Role catalogue editor. Every change needs a reason + 2FA (prompted automatically). */
export default function RolesTab() {
  const { has } = usePermissions();
  const canManage = has("roles.mutate");
  const confirm = useConfirm();
  const [roles, setRoles] = useState<AdminRoleRecord[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [assignUser, setAssignUser] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const pick = (role: AdminRoleRecord) => {
    setSelectedRoleId(role.id);
    setName(role.name);
    setDescription(role.description ?? "");
    setSelected(role.permissions);
  };

  const load = useCallback(async (keepSelection = true) => {
    try {
      setLoading(true);
      setError("");
      const data = await rolesAPI.list();
      setRoles(data.roles);
      setPermissions(data.permissions);
      setSelectedRoleId((current) => {
        const existing = keepSelection ? data.roles.find((r) => r.id === current) : undefined;
        const target = existing ?? data.roles[0];
        if (target) pick(target);
        return target?.id ?? "";
      });
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load admin roles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const role = roles.find((r) => r.id === selectedRoleId);
  const isSuperRole = role?.permissions.includes("admin.*");

  const toggle = (p: string) => setSelected((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  const save = () =>
    confirm.ask(
      {
        title: selectedRoleId ? `Save changes to ${role?.name ?? "role"}?` : `Create role ${name}?`,
        description: "Permission changes apply to every administrator holding this role on their next request.",
        confirmLabel: "Save role",
        tone: "primary",
      },
      async (reason) => {
        const payload = { name, description, permissions: selected, reason };
        if (selectedRoleId) {
          await rolesAPI.update(selectedRoleId, payload);
          setSuccess("Role updated.");
        } else {
          const created = await rolesAPI.create(payload);
          setSelectedRoleId(created.role.id);
          setSuccess("Role created.");
        }
        await load();
      },
    );

  if (loading && roles.length === 0) return <LoadingPanel label="Loading roles..." />;
  if (error && roles.length === 0) return <ErrorPanel message={error} onRetry={() => void load()} />;

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black">Roles</h2>
            <p className="mt-2 text-sm text-slate-500">Least-privilege access profiles.</p>
          </div>
          {canManage ? (
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedRoleId("");
                setName("");
                setDescription("");
                setSelected(["dashboard.read"]);
                setSuccess("");
              }}
            >
              <Icon name="plus" /> New
            </Button>
          ) : null}
        </div>
        <div className="mt-6 space-y-3">
          {roles.map((r) => (
            <button key={r.id} onClick={() => { pick(r); setSuccess(""); setError(""); }} className={`w-full rounded-xl border p-4 text-left ${selectedRoleId === r.id ? "border-[#096B4A] bg-emerald-50" : "border-slate-200"}`}>
              <p className="font-black">{r.name}</p>
              <p className="mt-1 text-sm text-slate-500">
                {r.permissions.includes("admin.*") ? "Full access" : `${r.permissions.length} permissions`} · {r.assignments.length} admin{r.assignments.length === 1 ? "" : "s"}
              </p>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-black">{selectedRoleId ? "Edit role" : "Create role"}</h2>
            <p className="mt-2 text-sm text-slate-500">Admins with this role can only use the selected backend actions.</p>
          </div>
          {role?.isSystem ? <Badge tone="green">System role</Badge> : null}
        </div>

        {error ? <div className="mt-4"><Banner tone="danger">{error}</Banner></div> : null}
        {success ? <div className="mt-4"><Banner tone="success">{success}</Banner></div> : null}
        {!canManage ? <div className="mt-4"><Banner tone="info">You can view roles but not change them (needs roles.mutate).</Banner></div> : null}

        <fieldset disabled={!canManage} className="disabled:opacity-80">
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label><span className="text-sm font-bold">Role name</span><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></label>
            <label><span className="text-sm font-bold">Description</span><input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} /></label>
          </div>

          <h3 className="mt-8 text-lg font-black">Permissions</h3>
          {isSuperRole ? <p className="mt-2 text-sm text-slate-500">This role holds the admin.* wildcard: every permission, including ones added later.</p> : null}
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {permissions.map((p) => (
              <label key={p} className={`flex items-center gap-3 rounded-xl border p-3 ${selected.includes(p) || isSuperRole ? "border-[#096B4A] bg-emerald-50" : "border-slate-200"}`}>
                <input type="checkbox" checked={selected.includes(p) || Boolean(isSuperRole)} onChange={() => toggle(p)} className="h-4 w-4 accent-[#096B4A]" />
                <span className="text-sm font-bold">{p}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {canManage ? (
          <div className="mt-8 flex flex-wrap gap-3">
            <Button disabled={name.trim().length < 2} onClick={save}>Save role</Button>
            {selectedRoleId ? (
              <Button
                disabled={role?.isSystem}
                variant="danger"
                onClick={() =>
                  confirm.ask({ title: `Delete ${role?.name}?`, description: "This cannot be undone. Roles that are still assigned cannot be left without access." , confirmLabel: "Delete role" }, async (reason) => {
                    await rolesAPI.delete(selectedRoleId, reason);
                    setSuccess("Role deleted.");
                    await load(false);
                  })
                }
              >
                Delete role
              </Button>
            ) : null}
          </div>
        ) : null}

        {selectedRoleId && canManage ? (
          <div className="mt-10 border-t border-slate-200 pt-8">
            <h3 className="text-lg font-black">Assign administrator</h3>
            <p className="mt-1 text-sm text-slate-500">To add a new person, use Invite on the Team tab. This attaches this role to an existing administrator.</p>
            <div className="mt-4 flex gap-3">
              <input value={assignUser} onChange={(e) => setAssignUser(e.target.value)} placeholder="Admin email or user ID" aria-label="Admin email or user ID" className="h-12 flex-1 rounded-xl border border-slate-300 px-4 outline-none focus:border-[#096B4A]" />
              <Button
                disabled={!assignUser.trim()}
                onClick={() =>
                  confirm.ask({ title: `Assign ${role?.name} to ${assignUser.trim()}?`, confirmLabel: "Assign", tone: "primary" }, async (reason) => {
                    await rolesAPI.assign(selectedRoleId, assignUser.trim(), reason);
                    setAssignUser("");
                    setSuccess("Role assigned.");
                    await load();
                  })
                }
              >
                Assign
              </Button>
            </div>
            <div className="mt-5 space-y-3">
              {role?.assignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                  <div>
                    <p className="font-bold">{a.user?.name ?? "Unnamed"}</p>
                    <p className="text-sm text-slate-500">{a.user?.email ?? "Not provided"}</p>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      confirm.ask({ title: `Remove ${a.user?.name ?? "this admin"} from ${role?.name}?`, confirmLabel: "Remove" }, async (reason) => {
                        await rolesAPI.removeAssignment(a.id, reason);
                        setSuccess("Assignment removed.");
                        await load();
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
              {role && role.assignments.length === 0 ? <p className="text-sm text-slate-500">Nobody holds this role yet.</p> : null}
            </div>
          </div>
        ) : null}
      </Card>
      {confirm.dialog}
    </div>
  );
}
