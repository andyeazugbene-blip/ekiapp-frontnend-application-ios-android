"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button, Card, ErrorPanel, Icon, LoadingPanel, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { communicationsAPI } from "@/lib/services/communications.api";

type OfferAudience =
  | "all_buyers"
  | "last_30_days"
  | "repeat_buyers"
  | "inactive_buyers"
  | "bought_specific_product"
  | "first_time_buyers"
  | "top_customers"
  | "all_vendors"
  | "active_vendors"
  | "new_vendors"
  | "individual_vendor"
  | "individual_buyer";

type BroadcastChannel = "in_app" | "push" | "sms";

interface AudienceOption {
  id: OfferAudience;
  label: string;
  helper: string;
}

const AUDIENCES: AudienceOption[] = [
  { id: "all_buyers", label: "All buyers", helper: "Every buyer with an account on the platform." },
  { id: "last_30_days", label: "Last 30 days buyers", helper: "Buyers who placed an order in the last 30 days." },
  { id: "repeat_buyers", label: "Repeat Buyers", helper: "Buyers with two or more orders." },
  { id: "inactive_buyers", label: "Inactive Buyers", helper: "Buyers without an order in the last 30 days." },
  { id: "bought_specific_product", label: "Bought Specific Product", helper: "Buyers who ordered a specific product." },
  { id: "first_time_buyers", label: "First-Time Buyers", helper: "Buyers with exactly one order." },
  { id: "top_customers", label: "Top Customers", helper: "Highest-spending buyers (top 20%)." },
  { id: "all_vendors", label: "All vendors", helper: "Every vendor on the platform." },
  { id: "active_vendors", label: "Active vendors", helper: "Approved and active vendors." },
  { id: "new_vendors", label: "New vendors", helper: "Vendors registered in the last 7 days." },
  { id: "individual_vendor", label: "Individual vendor", helper: "Send to a specific vendor only." },
  { id: "individual_buyer", label: "Individual buyer", helper: "Send to a specific buyer only." },
];

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default function SendOfferPage() {
  const [audience, setAudience] = useState<OfferAudience>("all_buyers");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [channels, setChannels] = useState<BroadcastChannel[]>(["in_app", "push"]);
  const [estimatedRecipients, setEstimatedRecipients] = useState<number | null>(null);

  const toggleChannel = (channel: BroadcastChannel) => {
    setChannels((prev) => prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]);
  };

  const mapAudienceToBackend = (audience: OfferAudience): { audience: string; vendorId?: string; userId?: string; productId?: string } => {
    switch (audience) {
      case "all_buyers": return { audience: "buyers" };
      case "last_30_days": return { audience: "last_30_days_buyers" };
      case "repeat_buyers": return { audience: "repeat_buyers" };
      case "inactive_buyers": return { audience: "inactive_buyers" };
      case "first_time_buyers": return { audience: "first_time_buyers" };
      case "top_customers": return { audience: "top_customers" };
      case "bought_specific_product": return { audience: "bought_specific_product", productId: selectedProductId };
      case "all_vendors": return { audience: "vendors" };
      case "active_vendors": return { audience: "active_vendors" };
      case "new_vendors": return { audience: "new_vendors" };
      case "individual_vendor": return { audience: "individual_vendor", vendorId: selectedVendorId };
      case "individual_buyer": return { audience: "individual_buyer", userId: selectedBuyerId };
      default: return { audience: "buyers" };
    }
  };

  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [selectedBuyerId, setSelectedBuyerId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");

  const handleSend = async () => {
    setError("");
    setSuccess("");

    if (!message.trim()) {
      setError("Please write your offer message.");
      return;
    }
    if (channels.length === 0) {
      setError("Select at least one delivery channel.");
      return;
    }
    if (audience === "individual_vendor" && !selectedVendorId) {
      setError("Please select a vendor.");
      return;
    }
    if (audience === "individual_buyer" && !selectedBuyerId) {
      setError("Please select a buyer.");
      return;
    }
    if (audience === "bought_specific_product" && !selectedProductId) {
      setError("Please select a product.");
      return;
    }

    setSubmitting(true);
    try {
      const { audience: backendAudience, vendorId, userId, productId } = mapAudienceToBackend(audience);
      const result = await communicationsAPI.sendBroadcast({
        title: "Special Offer",
        body: message.trim(),
        audience: backendAudience as any,
        channels,
        vendorId,
        buyerId: userId,
        productId,
      });
      setSuccess(`Offer sent. ${result.sent ?? result.recipients ?? ""} recipient(s) notified. ${result.smsQueued ? `SMS queued: ${result.smsQueued}.` : ""}`);
      setMessage("");
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Could not send offer.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedAudience = useMemo(
    () => AUDIENCES.find((option) => option.id === audience) ?? AUDIENCES[0],
    [audience],
  );

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-8">
          <PageHeader
            title="Send Offer"
            subtitle="Send targeted offers to buyers or vendors based on their activity."
          />

          {error ? <ErrorPanel message={error} onRetry={() => setError("")} /> : null}
          {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-[#096B4A]">{success}</div> : null}

          <Card>
            <h2 className="text-xl font-black">Target audience</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              {AUDIENCES.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setAudience(option.id)}
                  className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                    audience === option.id ? "bg-[#096B4A] text-white" : "bg-slate-100 text-slate-700 hover:bg-emerald-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-500">{selectedAudience.helper}</p>
          </Card>

          <Card>
            <h2 className="text-xl font-black">Delivery channels</h2>
            <div className="mt-6 flex flex-wrap gap-4">
              {(["in_app", "push", "sms"] as const).map((channel) => (
                <button
                  key={channel}
                  onClick={() => toggleChannel(channel)}
                  className={`rounded-xl border px-6 py-4 text-left transition ${
                    channels.includes(channel) ? "border-[#096B4A] bg-emerald-50" : "border-slate-200 hover:border-emerald-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`flex h-6 w-6 items-center justify-center rounded ${channels.includes(channel) ? "bg-[#096B4A] text-white" : "border border-slate-400"}`}>
                      {channels.includes(channel) ? <Icon name="check" className="h-4 w-4" /> : null}
                    </span>
                    <span className="font-bold capitalize">{channel === "in_app" ? "In-app" : channel === "push" ? "Push" : "SMS"}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {channel === "in_app" ? "App notifications + messages" : channel === "push" ? "Expo push notifications" : "Africa's Talking SMS"}
                  </p>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-xl font-black">Offer details</h2>
            <div className="mt-6 space-y-4">
              <label className="text-sm font-bold text-gray-700">Offer message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="Share the offer details, discount info, and expiry date."
                className="w-full resize-none rounded-xl border border-slate-300 p-4 outline-none focus:border-[#096B4A]"
                maxLength={1000}
              />
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>{message.length} / 1000</span>
              </div>
            </div>
          </Card>

          <Button disabled={submitting} onClick={() => void handleSend()} className="h-14 w-full text-base">
            {submitting ? "Sending..." : "Send Offer"}
          </Button>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
