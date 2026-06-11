"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button, Card, ErrorPanel, Icon, LoadingPanel, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { rolesAPI, AdminRoleRecord } from "@/lib/services/roles.api";
import { APIError } from "@/lib/api";

export default function RolesPage() {
  const [roles, setRoles] = useState<AdminRoleRecord[]>([]);
  const [permissionsList, setPermissionsList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPerms, setFormPerms] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const loadRoles = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await rolesAPI.list();
      setRoles(data.roles ?? []);
      setPermissionsList(data.permissions ?? []);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load roles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  const togglePerm = (perm: string) => {
    setFormPerms((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!formName.trim()) {
      setError("Role name is required.");
      return;
    }
    try {
      setSubmitting(true);
      setError("");
      await rolesAPI.create({
        name: formName.trim(),
        description: formDesc.trim() || undefined,
        permissions: [...formPerms],
      });
      setShowCreateForm(false);
      setFormName("");
      setFormDesc("");
      setFormPerms(new Set());
      await loadRoles();
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to create role");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (roleId: string) => {
    if (!confirm("Delete this role? This cannot be undone.")) return;
    try {
      await rolesAPI.delete(roleId);
      await loadRoles();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to delete role");
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <LoadingPanel label="Loading roles..." />
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-8">
          <PageHeader
            title="Admin roles"
            subtitle="Manage admin roles and access permissions."
            actions={
              <Button onClick={() => setShowCreateForm(!showCreateForm)}>
                <Icon name="plus" /> {showCreateForm ? "Cancel" : "Create role"}
              </Button>
            }
          />

          {error ? <ErrorPanel message={error} onRetry={() => setError("")} /> : null}

          {showCreateForm && (
            <Card>
              <h2 className="text-xl font-black">New role</h2>
              <div className="mt-6 space-y-4">
                <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Role name" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]" />
                <input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Description (optional)" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]" />
                <div>
                  <p className="mb-3 text-sm font-bold text-gray-700">Permissions</p>
                  <div className="flex flex-wrap gap-2">
                    {permissionsList.map((perm) => (
                      <button
                        key={perm}
                        onClick={() => togglePerm(perm)}
                        className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                          formPerms.has(perm) ? "border-[#096B4A] bg-emerald-50 text-[#096B4A]" : "border-slate-200 text-slate-600 hover:border-emerald-200"
                        }`}
                      >
                        {perm}
                      </button>
                    ))}
                  </div>
                </div>
                <Button disabled={submitting} onClick={() => void handleCreate()} className="w-full">
                  {submitting ? "Creating..." : "Create role"}
                </Button>
              </div>
            </Card>
          )}

          <div className="space-y-4">
            {roles.map((role) => (
              <Card key={role.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-black">{role.name}</h3>
                      {role.isSystem && (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">System</span>
                      )}
                    </div>
                    {role.description && <p className="mt-1 text-sm text-slate-500">{role.description}</p>}
                  </div>
                  {!role.isSystem && (
                    <Button variant="danger" onClick={() => void handleDelete(role.id)}>Delete</Button>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {role.permissions.map((perm) => (
                    <span key={perm} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-[#096B4A]">
                      {perm}
                    </span>
                  ))}
                </div>
                {role.assignments.length > 0 && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <p className="mb-2 text-sm font-bold text-gray-600">Assigned to:</p>
                    <div className="flex flex-wrap gap-2">
                      {role.assignments.map((assignment) => (
                        <span key={assignment.id} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
                          {assignment.user?.name ?? assignment.user?.email ?? "Unknown"}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
