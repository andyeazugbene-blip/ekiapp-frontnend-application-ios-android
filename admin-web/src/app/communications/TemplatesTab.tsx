"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, ErrorPanel, LoadingPanel } from "@/components/AdminUI";
import { Banner, formatDateTime } from "@/components/AdminKit";
import { APIError } from "@/lib/api";
import { communicationsAPI, type TemplateRow, type TemplateVersion } from "@/lib/services/communications.api";
import { CHANNEL_LABEL } from "./labels";

const ALL_CHANNELS = ["email", "push", "in_app"] as const;

export default function TemplatesTab({ canSend }: { canSend: boolean }) {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState<TemplateRow | null>(null);
  const [form, setForm] = useState({ title: "", body: "", enabled: true, channels: [] as string[], reason: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [versions, setVersions] = useState<{ key: string; list: TemplateVersion[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setTemplates((await communicationsAPI.templates.list()).templates); }
    catch (e) { setError(e instanceof APIError ? e.message : "Could not load templates."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const open = (t: TemplateRow) => {
    setEdit(t);
    setForm({ title: t.title, body: t.body, enabled: t.enabled, channels: [...t.channels], reason: "" });
    setFormError("");
  };

  const save = async () => {
    if (!edit) return;
    if (form.reason.trim().length < 5) { setFormError("Enter a reason of at least 5 characters (recorded in the audit log)."); return; }
    if (form.channels.length === 0) { setFormError("Select at least one channel."); return; }
    setSaving(true); setFormError("");
    try {
      await communicationsAPI.templates.update(edit.key, { title: form.title, body: form.body, channels: form.channels, enabled: form.enabled, reason: form.reason.trim() });
      setEdit(null); await load();
    } catch (e) { setFormError(e instanceof APIError ? e.message : "Could not save."); }
    finally { setSaving(false); }
  };

  const showVersions = async (key: string) => {
    try { setVersions({ key, list: (await communicationsAPI.templates.versions(key)).versions }); }
    catch (e) { setError(e instanceof APIError ? e.message : "Could not load versions."); }
  };

  return (
    <div className="space-y-4">
      <Banner tone="info">Templates drive automatic messages (welcome, order and verification updates, automations). Every change is versioned and audited with who, when and why. Disabling a template stops that automatic message.</Banner>
      {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
      {loading ? <LoadingPanel label="Loading templates…" /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.length === 0 ? (
            <Card className="md:col-span-2 xl:col-span-3"><p className="text-sm text-slate-600">No templates stored yet.</p>
              {canSend ? <Button className="mt-3" variant="secondary" onClick={async () => { await communicationsAPI.templates.seed(); await load(); }}>Seed defaults</Button> : null}</Card>
          ) : templates.map((t) => (
            <Card key={t.key} className="!p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-black capitalize text-[#101820]">{t.key.replace(/_/g, " ")}</h3>
                <Badge tone={t.enabled ? "green" : "gray"}>{t.enabled ? "Enabled" : "Disabled"}</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">{t.recipientType === "VENDOR" ? "Vendors" : "Buyers"} · {t.channels.map((c) => CHANNEL_LABEL[c]).join(", ")}</p>
              <div className="mt-3 rounded-xl bg-slate-50 p-3">
                <p className="text-sm font-bold">{t.title}</p>
                <p className="mt-1 text-sm text-slate-600">{t.body}</p>
              </div>
              <div className="mt-3 flex gap-2">
                {canSend ? <Button variant="secondary" className="h-9 px-3" onClick={() => open(t)}>Edit</Button> : null}
                <Button variant="ghost" className="h-9 px-3" onClick={() => void showVersions(t.key)}>History</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {edit ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Edit template">
          <div className="w-full max-w-lg space-y-3 rounded-[20px] bg-white p-6">
            <h3 className="text-xl font-black capitalize">Edit: {edit.key.replace(/_/g, " ")}</h3>
            <label className="block text-sm font-bold">Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 font-normal" /></label>
            <label className="block text-sm font-bold">Body<textarea value={form.body} rows={5} onChange={(e) => setForm({ ...form, body: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal" /></label>
            <fieldset>
              <legend className="text-sm font-bold">Channels</legend>
              <div className="mt-1 flex gap-4">
                {ALL_CHANNELS.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[#096B4A]" checked={form.channels.includes(c)}
                    onChange={(e) => setForm({ ...form, channels: e.target.checked ? [...form.channels, c] : form.channels.filter((x) => x !== c) })} />{CHANNEL_LABEL[c]}</label>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" className="accent-[#096B4A]" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />Enabled</label>
            <label className="block text-sm font-bold">Reason for the change (audit log)<textarea value={form.reason} rows={2} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal" /></label>
            {formError ? <p className="text-sm font-bold text-red-700">{formError}</p> : null}
            <div className="flex gap-3"><Button className="flex-1" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save new version"}</Button><Button className="flex-1" variant="ghost" onClick={() => setEdit(null)}>Close</Button></div>
          </div>
        </div>
      ) : null}

      {versions ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Template history">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[20px] bg-white p-6">
            <div className="flex items-center justify-between"><h3 className="text-xl font-black capitalize">History: {versions.key.replace(/_/g, " ")}</h3><Button variant="ghost" onClick={() => setVersions(null)}>Close</Button></div>
            {versions.list.length === 0 ? <p className="mt-4 text-sm text-slate-600">No edits recorded yet. The first edit stores the original as version 1.</p> : (
              <ol className="mt-4 space-y-3">
                {versions.list.map((v) => (
                  <li key={v.id} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-sm font-black">Version {v.version} · {formatDateTime(v.createdAt)} · {v.changedBy?.name ?? "System / original"}</p>
                    {v.reason ? <p className="text-xs text-slate-500">Reason: {v.reason}</p> : null}
                    <p className="mt-2 text-sm font-bold">{v.title}</p>
                    <p className="text-sm text-slate-600">{v.body}</p>
                    <p className="mt-1 text-xs text-slate-500">{v.channels.join(", ")} · {v.enabled ? "enabled" : "disabled"}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
