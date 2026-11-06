"use client";

import { useState } from "react";
import { Button } from "@/components/AdminUI";
import { useConfirm } from "@/components/AdminKit";
import { apiClient } from "@/lib/api";

type Contact = { email: string | null; phone: string | null };

const PATHS = {
  user: (id: string) => `/admin/users/${id}/reveal-contact`,
  vendor: (id: string) => `/admin/vendors/${id}/reveal-contact`,
  supplier: (id: string) => `/admin/community-buy/supplier-accounts/${id}/reveal-contact`,
};

/** Contact details are masked by default. Revealing needs a reason and is recorded in the audit log. */
export default function RevealContact({ kind, id }: { kind: keyof typeof PATHS; id: string }) {
  const [contact, setContact] = useState<Contact | null>(null);
  const c = useConfirm();

  if (contact) {
    return (
      <span className="text-sm">
        {contact.email ?? "No email"} · {contact.phone ?? "No phone"}
      </span>
    );
  }

  return (
    <>
      <Button
        variant="secondary"
        className="h-8 px-3"
        onClick={() => c.ask(
          {
            tone: "primary",
            title: "Reveal contact details?",
            description: "Your name and reason are recorded in the audit log.",
            confirmLabel: "Reveal",
          },
          async (reason) => {
            const res = await apiClient.post<{ contact: Contact }>(PATHS[kind](id), { reason });
            setContact(res.contact);
          },
        )}
      >
        Reveal contact details
      </Button>
      {c.dialog}
    </>
  );
}
