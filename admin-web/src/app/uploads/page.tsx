"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import { uploadsAPI } from "@/lib/services/uploads.api";
import { UploadAsset } from "@/types";

export default function UploadsPage() {
  const [assets, setAssets] = useState<UploadAsset[]>([]);
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setAssets(await uploadsAPI.list({ category: category || undefined }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load uploads.");
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => { void load(); }, [load]);

  const open = async (asset: UploadAsset) => {
    setOpeningId(asset.id);
    setError("");
    try {
      const readUrl = await uploadsAPI.getReadUrl(asset.id);
      window.open(readUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open this upload.");
    } finally {
      setOpeningId("");
    }
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-7">
          <PageHeader title="Upload review" subtitle="Review completed public assets and private verification documents through short-lived access URLs." actions={<Button variant="ghost" onClick={() => void load()}>Refresh</Button>} />
          {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
          <div className="flex flex-wrap gap-2">
            {["", "verification", "product", "avatar", "cover", "message"].map((value) => <button key={value || "all"} onClick={() => setCategory(value)} className={`rounded-xl border px-4 py-2 text-sm font-bold ${category === value ? "border-[#096B4A] bg-emerald-50 text-[#096B4A]" : "border-slate-200 bg-white text-slate-600"}`}>{value || "All uploads"}</button>)}
          </div>
          {loading ? <LoadingPanel label="Loading uploads..." /> : (
            <div className="grid gap-4 lg:grid-cols-2">
              {assets.map((asset) => (
                <Card key={asset.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0"><p className="font-black capitalize">{asset.category}</p><p className="mt-1 truncate text-xs text-slate-500">{asset.key}</p></div>
                    <Badge tone={asset.status === "COMPLETED" ? "green" : asset.status === "FAILED" ? "red" : "amber"}>{asset.status}</Badge>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm"><p><span className="text-slate-500">Owner</span><br />{asset.ownerId}</p><p><span className="text-slate-500">Type</span><br />{asset.contentType}</p></div>
                  <Button className="mt-5 w-full" disabled={asset.status !== "COMPLETED" || openingId === asset.id} onClick={() => void open(asset)}>{openingId === asset.id ? "Opening..." : "Open securely"}</Button>
                </Card>
              ))}
              {assets.length === 0 ? <Card><p className="text-sm text-slate-500">No uploads match this filter.</p></Card> : null}
            </div>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
