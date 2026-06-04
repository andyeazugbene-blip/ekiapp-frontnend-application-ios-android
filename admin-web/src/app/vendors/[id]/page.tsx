"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, Icon, LoadingPanel, PageHeader, TextLink } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { vendorsAPI } from "@/lib/services/vendors.api";
import { Vendor } from "@/types";

export default function VendorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const vendorId = params.id as string;
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadVendor = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setVendor(await vendorsAPI.getVendor(vendorId));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load vendor");
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    void loadVendor();
  }, [loadVendor]);

  const runAction = async (action: "approve" | "reject") => {
    if (!vendor) return;
    if (!confirm(`${action === "approve" ? "Approve" : "Reject"} ${vendor.storeName}?`)) return;
    try {
      setActionLoading(true);
      if (action === "approve") await vendorsAPI.approveVendor(vendor.id);
      if (action === "reject") await vendorsAPI.rejectVendor(vendor.id);
      await loadVendor();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Vendor action failed");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? (
          <LoadingPanel label="Loading vendor details..." />
        ) : error || !vendor ? (
          <ErrorPanel message={error || "Vendor not found"} onRetry={() => router.push("/vendors")} />
        ) : (
          <div className="space-y-8">
            <TextLink href="/vendors">← Back to vendors</TextLink>
            <PageHeader
              title="Vendor details"
              actions={
                <>
                  <span className="text-base text-slate-600">Joined: {vendor.joinedAt ? new Date(vendor.joinedAt).toLocaleDateString() : "N/A"}</span>
                  <StatusBadge status={vendor.adminStatus} />
                </>
              }
            />

            <Card className="overflow-hidden p-0">
              <div className="h-40 bg-gradient-to-r from-[#143e34] via-[#0b6b4a] to-[#101820]">
                {vendor.coverImage ? <Image src={vendor.coverImage} alt="" width={1200} height={260} unoptimized className="h-full w-full object-cover" /> : null}
              </div>
              <div className="grid gap-6 p-8 lg:grid-cols-[1fr_0.48fr]">
                <div className="flex items-center gap-6">
                  {vendor.avatar ? <Image src={vendor.avatar} alt="" width={80} height={80} unoptimized className="h-20 w-20 rounded-full object-cover" /> : <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-2xl font-black text-amber-700">{vendor.storeName.slice(0, 2).toUpperCase()}</div>}
                  <div>
                    <h2 className="text-3xl font-black">{vendor.storeName}</h2>
                    <p className="mt-2 flex items-center gap-2 text-lg text-slate-600"><Icon name="overview" className="h-5 w-5" /> {vendor.ownerName}</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoTile icon="overview" label="Country" value={vendor.country || "Unknown"} />
                  <InfoTile icon="overview" label="City" value={vendor.city || "Unknown"} />
                </div>
              </div>
            </Card>

            <div className="grid gap-6 lg:grid-cols-[0.48fr_0.52fr]">
              <div className="space-y-6">
                <Card>
                  <h3 className="text-xl font-black">Description</h3>
                  <p className="mt-5 text-lg leading-8 text-slate-600">{vendor.description || "No store description has been provided."}</p>
                </Card>
                <Card>
                  <h3 className="text-xl font-black">First-sale progress</h3>
                  <div className="mt-6 space-y-6">
                    <ProgressStep done label="Add foodstuff" note="Completed" date={vendor.joinedAt} />
                    <ProgressStep done label="Set delivery" note="Completed" date={vendor.joinedAt} />
                    <ProgressStep active label="Verify account" note={vendor.verificationStatus.replace("_", " ")} />
                    <ProgressStep label="Share store link" note={vendor.storeSlug ? "Ready" : "Not started"} />
                  </div>
                </Card>
              </div>

              <div className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-3">
                  <InfoTile icon="verification" label="Verification" value={vendor.verificationStatus.replace("_", " ")} />
                  <InfoTile icon="analytics" label="Subscription" value={`${vendor.subscriptionPlan || "free"} Plan`} />
                  <InfoTile icon="orders" label="Total products" value={vendor.totalProducts.toString().padStart(2, "0")} />
                </div>
                <Card className="bg-[#096B4A] text-white">
                  <div className="flex items-center gap-6">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15"><Icon name="orders" className="h-8 w-8" /></div>
                    <div><p className="text-white/70">Total orders</p><p className="mt-1 text-3xl font-black">{vendor.totalOrders}</p></div>
                  </div>
                </Card>
                <Button disabled={actionLoading || vendor.adminStatus === "active"} onClick={() => void runAction("approve")} className="h-16 w-full text-xl"><Icon name="check" /> Approve Vendor</Button>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Button disabled={actionLoading} variant="danger" onClick={() => void runAction("reject")} className="h-16 text-xl">Reject</Button>
                  <Button variant="secondary" onClick={() => router.push(`/communication?vendorId=${vendor.id}`)} className="h-16 text-xl"><Icon name="messages" /> Message</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}

function InfoTile({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <Card className="flex items-center gap-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-[#096B4A]"><Icon name={icon} className="h-7 w-7" /></div>
      <div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-lg font-black capitalize">{value}</p></div>
    </Card>
  );
}

function ProgressStep({ done, active, label, note, date }: { done?: boolean; active?: boolean; label: string; note: string; date?: string }) {
  return (
    <div className="flex items-start gap-5">
      <div className={`flex h-10 w-10 items-center justify-center rounded-full border ${done ? "border-[#096B4A] bg-[#096B4A] text-white" : active ? "border-[#096B4A] text-[#096B4A]" : "border-slate-300 text-slate-400"}`}>{done ? <Icon name="check" className="h-5 w-5" /> : active ? "3" : "4"}</div>
      <div className="flex-1"><p className="text-lg font-bold">{label}</p><p className={`mt-1 text-sm ${active ? "text-amber-600" : "text-slate-500"}`}>{note}</p></div>
      {date ? <span className="text-sm text-[#096B4A]">{new Date(date).toLocaleDateString()}</span> : null}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge tone="green">Active</Badge>;
  if (status === "suspended") return <Badge tone="red">Suspended</Badge>;
  return <Badge tone="amber">Pending Approval</Badge>;
}
