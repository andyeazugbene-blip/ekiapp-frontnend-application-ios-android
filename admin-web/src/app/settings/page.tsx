"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, Icon, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { APIError } from "@/lib/api";
import { AdminRoleRecord, rolesAPI } from "@/lib/services/roles.api";

const tabs = ["General", "Notifications", "Security", "Users & Roles", "Integration", "System"];

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("General");
  const [apiStatus, setApiStatus] = useState<"checking" | "connected" | "error">("checking");
  const [saved, setSaved] = useState("");
  const [toggles, setToggles] = useState({
    vendorRegistration: true,
    autoApprove: false,
    requireVerification: true,
    autoReleaseEscrow: false,
    enableMarketplace: true,
  });

  const checkAPIStatus = async () => {
    try {
      setApiStatus("checking");
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`);
      setApiStatus(response.ok ? "connected" : "error");
    } catch {
      setApiStatus("error");
    }
  };

  useEffect(() => {
    void checkAPIStatus();
  }, []);

  const save = (section: string) => {
    setSaved(`${section} saved in this admin session. Add the platform settings endpoint to persist this globally.`);
    setTimeout(() => setSaved(""), 5000);
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-8">
          <PageHeader title="Settings" subtitle="Manage your platform preferences and configurations." />

          <div className="flex flex-wrap gap-8 border-b border-slate-200">
            {tabs.map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`border-b-2 px-4 pb-5 text-base font-bold ${activeTab === tab ? "border-[#096B4A] text-[#096B4A]" : "border-transparent text-slate-600"}`}>
                {tab}
              </button>
            ))}
          </div>

          {saved ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-800">{saved}</div> : null}

          {activeTab === "General" ? (
            <>
              <div className="grid gap-6 xl:grid-cols-2">
                <Card>
                  <h2 className="text-xl font-black">Platform information</h2>
                  <p className="mt-2 text-slate-500">Update your platform details.</p>
                  <div className="mt-8 space-y-6">
                    <Field label="Platform name" defaultValue="Eki Marketplace" />
                    <Field label="Support email" defaultValue="support@eki.com" />
                    <Select label="Timezone" options={["(UTC+01:00) West Africa Time (WAT)", "(UTC+00:00) United Kingdom"]} />
                    <Select label="Language" options={["English", "French"]} />
                  </div>
                  <div className="mt-6 text-right"><Button onClick={() => save("Platform information")}>Save changes</Button></div>
                </Card>

                <Card>
                  <h2 className="text-xl font-black">Business settings</h2>
                  <p className="mt-2 text-slate-500">Configure marketplace business preferences.</p>
                  <div className="mt-8 divide-y divide-slate-100">
                    <ToggleRow icon="vendors" title="Vendor registration" subtitle="Allow new vendors to register" value={toggles.vendorRegistration} onChange={() => setToggles((s) => ({ ...s, vendorRegistration: !s.vendorRegistration }))} />
                    <ToggleRow icon="verification" title="Auto approve vendors" subtitle="Automatically approve new vendor registrations" value={toggles.autoApprove} onChange={() => setToggles((s) => ({ ...s, autoApprove: !s.autoApprove }))} />
                    <ToggleRow icon="settings" title="Require verification" subtitle="Require document verification for vendors" value={toggles.requireVerification} onChange={() => setToggles((s) => ({ ...s, requireVerification: !s.requireVerification }))} />
                    <ToggleRow icon="money" title="Auto release escrow" subtitle="Automatically release escrow after delivery confirmation" value={toggles.autoReleaseEscrow} onChange={() => setToggles((s) => ({ ...s, autoReleaseEscrow: !s.autoReleaseEscrow }))} />
                    <ToggleRow icon="overview" title="Enable marketplace" subtitle="Make the marketplace live for all users" value={toggles.enableMarketplace} onChange={() => setToggles((s) => ({ ...s, enableMarketplace: !s.enableMarketplace }))} />
                  </div>
                </Card>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <Card>
                  <h2 className="text-xl font-black">Default commission</h2>
                  <p className="mt-2 text-slate-500">Set your default marketplace commission.</p>
                  <div className="mt-8 grid gap-6 md:grid-cols-2">
                    <Select label="Commission type" options={["Percentage (%)", "Fixed amount"]} />
                    <Field label="Commission rate" defaultValue="5" suffix="%" />
                  </div>
                  <p className="mt-4 text-sm text-slate-500">Plan-specific platform fees are managed in Subscription Plans.</p>
                  <div className="mt-6 text-right"><Button onClick={() => save("Default commission")}>Save changes</Button></div>
                </Card>
                <Card>
                  <h2 className="text-xl font-black">Branding</h2>
                  <p className="mt-2 text-slate-500">Customize your marketplace branding.</p>
                  <div className="mt-8 flex items-center justify-between border-b border-slate-200 pb-6">
                    <div className="flex items-center gap-4 text-3xl font-black"><span className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#096B4A] text-white"><Icon name="orders" /></span>Eki</div>
                    <Button variant="secondary" disabled title="Brand asset upload needs a backend settings endpoint."><Icon name="export" /> Upload new</Button>
                  </div>
                  <div className="mt-8 grid gap-6 md:grid-cols-2">
                    <Color label="Primary color" value="#096B4A" />
                    <Color label="Secondary color" value="#F3F4F6" />
                  </div>
                  <div className="mt-6 text-right"><Button onClick={() => save("Branding")}>Save changes</Button></div>
                </Card>
              </div>

              <Card className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div><h2 className="text-xl font-black text-red-600">Danger zone</h2><p className="mt-2 text-slate-500">Irreversible and destructive actions.</p></div>
                <Button variant="danger" disabled title="Disabled in production admin. Reset operations must run through an audited backend maintenance command.">Reset platform data</Button>
              </Card>
            </>
          ) : activeTab === "Users & Roles" ? (
            <RoleManager />
          ) : (
            <Card>
              <h2 className="text-xl font-black">{activeTab}</h2>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-5"><p className="font-bold">Signed in admin</p><p className="mt-2 text-slate-500">{user?.name} · {user?.email}</p></div>
                <div className="rounded-2xl border border-slate-200 p-5"><p className="font-bold">Backend API</p><p className="mt-2"><Badge tone={apiStatus === "connected" ? "green" : apiStatus === "error" ? "red" : "amber"}>{apiStatus}</Badge></p></div>
              </div>
              <Button onClick={() => void checkAPIStatus()} className="mt-6">Recheck backend</Button>
            </Card>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

function Field({ label, defaultValue, suffix }: { label: string; defaultValue: string; suffix?: string }) {
  return <label className="block"><span className="text-sm font-bold text-slate-700">{label}</span><div className="mt-2 flex h-12 items-center rounded-xl border border-slate-300 bg-white px-4"><input defaultValue={defaultValue} className="w-full bg-transparent outline-none" />{suffix ? <span className="font-bold text-slate-500">{suffix}</span> : null}</div></label>;
}

function Select({ label, options }: { label: string; options: string[] }) {
  return <label className="block"><span className="text-sm font-bold text-slate-700">{label}</span><select className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function ToggleRow({ icon, title, subtitle, value, onChange }: { icon: string; title: string; subtitle: string; value: boolean; onChange: () => void }) {
  return <div className="flex items-center gap-5 py-5"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-[#096B4A]"><Icon name={icon} className="h-6 w-6" /></div><div className="flex-1"><p className="font-bold">{title}</p><p className="text-sm text-slate-500">{subtitle}</p></div><button onClick={onChange} className={`flex h-7 w-12 items-center rounded-full p-1 transition ${value ? "justify-end bg-[#096B4A]" : "justify-start bg-slate-300"}`}><span className="h-5 w-5 rounded-full bg-white" /></button></div>;
}

function Color({ label, value }: { label: string; value: string }) {
  return <label className="block"><span className="text-sm font-bold text-slate-700">{label}</span><div className="mt-2 flex h-12 items-center gap-3 rounded-xl border border-slate-300 px-4"><span className="h-6 w-6 rounded" style={{ background: value }} /><span className="font-semibold">{value}</span></div></label>;
}

function RoleManager() {
  const [roles, setRoles] = useState<AdminRoleRecord[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [assignUser, setAssignUser] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await rolesAPI.list();
      setRoles(data.roles);
      setPermissions(data.permissions);
      const first = data.roles[0];
      if (!selectedRoleId && first) {
        setSelectedRoleId(first.id);
        setName(first.name);
        setDescription(first.description ?? "");
        setSelectedPermissions(first.permissions);
      }
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load admin roles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedRole = roles.find((role) => role.id === selectedRoleId);

  const selectRole = (role: AdminRoleRecord) => {
    setSelectedRoleId(role.id);
    setName(role.name);
    setDescription(role.description ?? "");
    setSelectedPermissions(role.permissions);
    setError("");
    setSuccess("");
  };

  const newRole = () => {
    setSelectedRoleId("");
    setName("");
    setDescription("");
    setSelectedPermissions(["dashboard.read"]);
    setError("");
    setSuccess("");
  };

  const togglePermission = (permission: string) => {
    setSelectedPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
    );
  };

  const saveRole = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const payload = { name, description, permissions: selectedPermissions };
      if (selectedRoleId) {
        await rolesAPI.update(selectedRoleId, payload);
        setSuccess("Role updated.");
      } else {
        const created = await rolesAPI.create(payload);
        setSelectedRoleId(created.role.id);
        setSuccess("Role created.");
      }
      await load();
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to save role");
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async () => {
    if (!selectedRoleId || !confirm("Delete this admin role?")) return;
    try {
      setSaving(true);
      await rolesAPI.delete(selectedRoleId);
      setSuccess("Role deleted.");
      setSelectedRoleId("");
      await load();
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to delete role");
    } finally {
      setSaving(false);
    }
  };

  const assign = async () => {
    if (!selectedRoleId || !assignUser.trim()) return;
    try {
      setSaving(true);
      await rolesAPI.assign(selectedRoleId, assignUser.trim());
      setAssignUser("");
      setSuccess("Role assigned.");
      await load();
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to assign role");
    } finally {
      setSaving(false);
    }
  };

  const removeAssignment = async (assignmentId: string) => {
    if (!confirm("Remove this role assignment?")) return;
    try {
      setSaving(true);
      await rolesAPI.removeAssignment(assignmentId);
      setSuccess("Assignment removed.");
      await load();
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to remove assignment");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Card><div className="py-12 text-center font-bold text-slate-500">Loading roles...</div></Card>;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <Card>
        <div className="flex items-center justify-between">
          <div><h2 className="text-xl font-black">Admin roles</h2><p className="mt-2 text-sm text-slate-500">Create limited admin access profiles.</p></div>
          <Button onClick={newRole} variant="secondary"><Icon name="plus" /> New</Button>
        </div>
        <div className="mt-6 space-y-3">
          {roles.map((role) => (
            <button key={role.id} onClick={() => selectRole(role)} className={`w-full rounded-xl border p-4 text-left ${selectedRoleId === role.id ? "border-[#096B4A] bg-emerald-50" : "border-slate-200"}`}>
              <p className="font-black">{role.name}</p>
              <p className="mt-1 text-sm text-slate-500">{role.permissions.length} permissions · {role.assignments.length} admins</p>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div><h2 className="text-xl font-black">{selectedRoleId ? "Edit role" : "Create role"}</h2><p className="mt-2 text-sm text-slate-500">Admins with this role can only use selected backend actions.</p></div>
          {selectedRole?.isSystem ? <Badge tone="green">System role</Badge> : null}
        </div>

        {error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}
        {success ? <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-[#096B4A]">{success}</div> : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label><span className="text-sm font-bold">Role name</span><input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-[#096B4A]" /></label>
          <label><span className="text-sm font-bold">Description</span><input value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-[#096B4A]" /></label>
        </div>

        <h3 className="mt-8 text-lg font-black">Permissions</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {permissions.map((permission) => (
            <label key={permission} className={`flex items-center gap-3 rounded-xl border p-3 ${selectedPermissions.includes(permission) ? "border-[#096B4A] bg-emerald-50" : "border-slate-200"}`}>
              <input type="checkbox" checked={selectedPermissions.includes(permission)} onChange={() => togglePermission(permission)} className="h-4 w-4 accent-[#096B4A]" />
              <span className="text-sm font-bold">{permission}</span>
            </label>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button disabled={saving} onClick={() => void saveRole()}>{saving ? "Saving..." : "Save role"}</Button>
          {selectedRoleId ? <Button disabled={saving || selectedRole?.isSystem} variant="danger" onClick={() => void deleteRole()}>Delete role</Button> : null}
        </div>

        {selectedRoleId ? (
          <div className="mt-10 border-t border-slate-200 pt-8">
            <h3 className="text-lg font-black">Assign admin</h3>
            <div className="mt-4 flex gap-3">
              <input value={assignUser} onChange={(event) => setAssignUser(event.target.value)} placeholder="Admin email or user ID" className="h-12 flex-1 rounded-xl border border-slate-300 px-4 outline-none focus:border-[#096B4A]" />
              <Button disabled={saving} onClick={() => void assign()}>Assign</Button>
            </div>
            <div className="mt-5 space-y-3">
              {selectedRole?.assignments.map((assignment) => (
                <div key={assignment.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                  <div><p className="font-bold">{assignment.user?.name ?? assignment.userId}</p><p className="text-sm text-slate-500">{assignment.user?.email}</p></div>
                  <Button variant="ghost" disabled={saving} onClick={() => void removeAssignment(assignment.id)}>Remove</Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
