/**
 * Admin broadcasts may carry `data.link`, an in-app route chosen from an
 * allow-list in the admin panel (backend comms-utils ALLOWED_DEEP_LINKS).
 * Validate again here so a malformed or foreign link can never navigate
 * anywhere unexpected, and never send a buyer into vendor screens or vice versa.
 */
const LINK_PATTERN = /^\/\((buyer|vendor)\)(\/[a-z0-9-]+)?(\?[A-Za-z0-9=&_.-]*)?$/;

export function resolveBroadcastLink(data: unknown, role: string | null | undefined): string | null {
  if (!data || typeof data !== "object") return null;
  const link = (data as Record<string, unknown>).link;
  if (typeof link !== "string") return null;
  const match = LINK_PATTERN.exec(link);
  if (!match) return null;
  const area = match[1];
  const isVendorSide = role === "vendor" || role === "admin";
  if (area === "vendor" && !isVendorSide) return null;
  if (area === "buyer" && role === "vendor") return null;
  return link;
}
