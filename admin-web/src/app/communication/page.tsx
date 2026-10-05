"use client";

import { redirect } from "next/navigation";

/** Duplicate of /communications (handbook gap 0.11) — kept only so old links still land somewhere useful. */
export default function LegacyCommunicationRedirect() {
  redirect("/communications");
}
