"use client";

import { useState } from "react";
import { Button } from "@/components/AdminUI";
import { useConfirm } from "@/components/AdminKit";
import { apiClient } from "@/lib/api";

type Result = { created: { campaigns: number; offers: number; orders: number; subscriptions: number } };

/** Opens the supplier account and adds one example of every status to a demo account. */
export default function FillDemoData({ userId }: { userId: string }) {
  const [message, setMessage] = useState("");
  const c = useConfirm();

  return (
    <>
      <Button
        variant="secondary"
        className="h-8 px-3"
        onClick={() => c.ask(
          {
            tone: "primary",
            title: "Fill this demo account?",
            description: "Opens its supplier account and adds every Community Buy, supplier, order and subscription status. Nothing reaches real accounts or real money. Running it again only adds what's missing.",
            confirmLabel: "Fill demo account",
          },
          async (reason) => {
            const { created } = await apiClient.post<Result>(`/admin/users/${userId}/demo-fill`, { reason });
            setMessage(`Added ${created.campaigns} Community Buys, ${created.offers} supplier offers, ${created.orders} orders and ${created.subscriptions} subscriptions.`);
          },
        )}
      >
        Fill demo data
      </Button>
      {message ? <span className="text-xs font-semibold text-slate-600">{message}</span> : null}
      {c.dialog}
    </>
  );
}
