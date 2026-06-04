"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, Icon, LoadingPanel, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { communicationsAPI, BroadcastAudience, BroadcastChannel } from "@/lib/services/communications.api";
import { vendorsAPI } from "@/lib/services/vendors.api";
import { Vendor } from "@/types";

const audiences: { id: BroadcastAudience; title: string; subtitle: string; icon: string }[] = [
  { id: "individual_vendor", title: "Individual vendor", subtitle: "Send message to a specific vendor", icon: "orders" },
  { id: "individual_buyer", title: "Individual buyer", subtitle: "Send message to a specific buyer", icon: "user" },
  { id: "vendors", title: "All vendors", subtitle: "Send message to all active vendors", icon: "vendors" },
  { id: "buyers", title: "All buyers", subtitle: "Send message to all buyers", icon: "vendors" },
  { id: "active_vendors", title: "Active vendors", subtitle: "Send message to approved vendors", icon: "check" },
  { id: "new_vendors", title: "Vendors with no first sale", subtitle: "Nudge vendors to complete activation", icon: "orders" },
];

export default function CommunicationPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [audience, setAudience] = useState<BroadcastAudience>("individual_vendor");
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [channels, setChannels] = useState<BroadcastChannel[]>(["in_app"]);
  const [sending, setSending] = useState(false);

  const loadVendors = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await vendorsAPI.getVendors({ limit: 100 });
      setVendors(data);
      setSelectedVendorId((current) => current || data[0]?.id || "");
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load communication targets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVendors();
  }, [loadVendors]);

  const filteredVendors = useMemo(() => {
    const term = search.toLowerCase();
    return vendors.filter((vendor) => `${vendor.storeName} ${vendor.ownerName} ${vendor.city} ${vendor.country}`.toLowerCase().includes(term)).slice(0, 8);
  }, [search, vendors]);

  const toggleChannel = (channel: BroadcastChannel) => {
    setChannels((current) => current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel]);
  };

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      setError("Message title and body are required.");
      return;
    }
    if (channels.length === 0) {
      setError("Select at least one delivery channel.");
      return;
    }
    if (audience === "individual_vendor" && !selectedVendorId) {
      setError("Choose a vendor target.");
      return;
    }

    try {
      setSending(true);
      setError("");
      setSuccess("");
      const result = await communicationsAPI.sendBroadcast({
        title,
        body,
        audience,
        channels,
        vendorId: audience === "individual_vendor" ? selectedVendorId : undefined,
      });
      setSuccess(`Message sent to ${result.sent ?? result.recipients ?? "selected"} recipient(s). SMS queued: ${result.smsQueued ?? 0}; skipped without consent: ${result.smsSkipped ?? 0}.`);
      setTitle("");
      setBody("");
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to send admin communication");
    } finally {
      setSending(false);
    }
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? (
          <LoadingPanel label="Loading communication center..." />
        ) : (
          <div className="space-y-8">
            <PageHeader
              title="Communication center"
              subtitle="Send targeted messages to vendors or buyers across different channels."
              actions={<Button variant="ghost" disabled title="Template storage is not enabled on the backend yet."><Icon name="messages" /> Message templates</Button>}
            />

            {error ? <ErrorPanel message={error} onRetry={() => setError("")} /> : null}
            {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-[#096B4A]">{success}</div> : null}

            <Card className="grid gap-8 lg:grid-cols-2">
              <div>
                <h2 className="text-xl font-black">1. Select target audience</h2>
                <div className="mt-6 space-y-3">
                  {audiences.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setAudience(item.id)}
                      className={`flex w-full items-center gap-5 rounded-xl border p-5 text-left transition ${audience === item.id ? "border-[#096B4A] bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-200"}`}
                    >
                      <span className={`h-5 w-5 rounded-full border ${audience === item.id ? "border-[#096B4A] bg-[#096B4A] ring-4 ring-emerald-100" : "border-slate-400"}`} />
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-[#096B4A]"><Icon name={item.icon} className="h-7 w-7" /></span>
                      <span><span className="block text-lg font-black">{item.title}</span><span className="mt-1 block text-sm text-slate-500">{item.subtitle}</span></span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-xl font-black">2. Choose vendor</h2>
                <div className="mt-6 flex h-14 items-center gap-3 rounded-xl border border-slate-300 px-4">
                  <Icon name="search" className="h-5 w-5 text-slate-400" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search vendor name, email or store..." className="w-full bg-transparent outline-none" />
                </div>
                <div className="mt-6 space-y-3">
                  {filteredVendors.map((vendor) => (
                    <button
                      key={vendor.id}
                      onClick={() => setSelectedVendorId(vendor.id)}
                      className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left ${selectedVendorId === vendor.id ? "border-[#096B4A] bg-emerald-50" : "border-slate-200"}`}
                    >
                      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-emerald-100 font-black text-[#096B4A]">{vendor.storeName.slice(0, 2).toUpperCase()}</div>
                      <div className="flex-1"><p className="text-lg font-black">{vendor.storeName}</p><p className="text-sm text-slate-500">{vendor.city}, {vendor.country}</p></div>
                      {selectedVendorId === vendor.id ? <Badge tone="green">Selected</Badge> : null}
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="grid gap-8 lg:grid-cols-[0.58fr_0.42fr]">
              <div>
                <h2 className="text-xl font-black">3. Select channel</h2>
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <ChannelCard active={channels.includes("in_app")} title="In-app" text="Creates app notification and admin message" icon="messages" onClick={() => toggleChannel("in_app")} />
                  <ChannelCard active={channels.includes("push")} title="Push" text="Sends Expo push to registered devices" icon="communication" onClick={() => toggleChannel("push")} />
                  <ChannelCard active={channels.includes("sms")} title="SMS" text="Africa's Talking, opted-in users only" icon="messages" onClick={() => toggleChannel("sms")} />
                  <ChannelCard disabled title="Email" text="Provider endpoint not enabled yet" icon="messages" onClick={() => undefined} />
                </div>
              </div>
              <div>
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Message title" className="mb-3 h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-[#096B4A]" />
                <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write your message here..." className="h-32 w-full resize-none rounded-xl border border-slate-300 p-4 outline-none focus:border-[#096B4A]" maxLength={1000} />
                <div className="mt-3 flex items-center justify-between text-sm text-slate-500"><span>Attach file (optional)</span><span>{body.length} / 1000</span></div>
                <Button disabled={sending} onClick={() => void handleSend()} className="mt-4 w-full"><Icon name="arrow" /> {sending ? "Sending..." : "Send Message"}</Button>
              </div>
            </Card>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}

function ChannelCard({ active = false, disabled = false, title, text, icon, onClick }: { active?: boolean; disabled?: boolean; title: string; text: string; icon: string; onClick: () => void }) {
  return (
    <button disabled={disabled} onClick={onClick} className={`rounded-xl border p-5 text-left ${active ? "border-[#096B4A] bg-emerald-50" : "border-slate-200 bg-white"} ${disabled ? "cursor-not-allowed opacity-55" : ""}`}>
      <div className="flex items-center gap-4"><span className={`flex h-6 w-6 items-center justify-center rounded ${active ? "bg-[#096B4A] text-white" : "border border-slate-400"}`}>{active ? <Icon name="check" className="h-4 w-4" /> : null}</span><Icon name={icon} className="h-7 w-7 text-[#096B4A]" /></div>
      <p className="mt-5 text-lg font-black">{title}</p>
      <p className="mt-2 text-sm text-slate-500">{text}</p>
    </button>
  );
}
