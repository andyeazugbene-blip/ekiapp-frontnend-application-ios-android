/**
 * Public share-link helpers for the Eki app.
 *
 * The public storefront is served from the production domain
 * `https://culinarytales.app` (with `https://www.culinarytales.app` as a www
 * alias and `https://ekiapp-backend.vercel.app` as the Vercel fallback).
 *
 * All in-app share buttons (vendor share, copy link, WhatsApp/Instagram share,
 * referral invites, promo links) must build URLs through these helpers so the
 * domain is centralized and easy to update.
 */

export const PUBLIC_DOMAIN = process.env.EXPO_PUBLIC_PUBLIC_WEB_URL || "https://culinarytales.app";
export const PUBLIC_DOMAIN_WWW = process.env.EXPO_PUBLIC_PUBLIC_WEB_URL_WWW || "https://www.culinarytales.app";
export const VERCEL_FALLBACK_URL =
  process.env.EXPO_PUBLIC_VERCEL_FALLBACK_URL || process.env.EXPO_PUBLIC_API_URL || "https://ekiapp-backend.vercel.app";

/**
 * Normalize an arbitrary string (e.g. a store name) into a URL-safe slug:
 * lowercase, dash-separated, ASCII-only, no spaces or special characters.
 */
export function toUrlSlug(value: string | undefined | null): string {
  if (!value) return "";
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // drop unsupported chars
    .replace(/\s+/g, "-") // spaces → dash
    .replace(/-+/g, "-") // collapse repeated dashes
    .replace(/^-|-$/g, ""); // trim leading/trailing dashes
}

export function toCompactStoreSlug(value: string | undefined | null): string {
  return toUrlSlug(value).replace(/-/g, "");
}

/**
 * Build the canonical public storefront URL for a vendor.
 *
 * Prefer the backend-provided `shareUrl` when available; otherwise build
 * `https://culinarytales.app/store/{slug}`.
 */
export function getPublicStoreUrl(input: {
  shareUrl?: string | null;
  storeSlug?: string | null;
  storeName?: string | null;
} | string): string {
  if (typeof input === "string") {
    const slug = toCompactStoreSlug(input);
    return slug ? `${PUBLIC_DOMAIN}/store/${slug}` : PUBLIC_DOMAIN;
  }

  const slug = toCompactStoreSlug(input?.storeSlug || input?.storeName);
  return slug ? `${PUBLIC_DOMAIN}/store/${slug}` : PUBLIC_DOMAIN;
}

/**
 * Build the canonical referral invite URL.
 */
export function getPublicReferralUrl(code: string | undefined | null): string {
  const safe = (code ?? "").trim();
  return safe ? `${PUBLIC_DOMAIN}/?ref=${encodeURIComponent(safe)}` : PUBLIC_DOMAIN;
}

/**
 * Build a public product URL for sharing a single product page.
 */
export function getPublicProductUrl(productIdOrSlug: string | undefined | null): string {
  const safe = (productIdOrSlug ?? "").trim();
  return safe ? `${PUBLIC_DOMAIN}/product/${encodeURIComponent(safe)}` : PUBLIC_DOMAIN;
}

/**
 * Build a public order URL (used for shareable order receipts / tracking).
 */
export function getPublicOrderUrl(orderId: string | undefined | null): string {
  const safe = (orderId ?? "").trim();
  return safe ? `${PUBLIC_DOMAIN}/order/${encodeURIComponent(safe)}` : PUBLIC_DOMAIN;
}

/**
 * Build a promo / campaign URL for a specific product on a vendor's storefront.
 */
export function getPublicPromoUrl(input: {
  shareUrl?: string | null;
  storeSlug?: string | null;
  storeName?: string | null;
  productSlug?: string | null;
  productName?: string | null;
  promoCode?: string | null;
}): string {
  const base = getPublicStoreUrl(input);
  const productSlug = input.productSlug || toUrlSlug(input.productName);
  const url = productSlug ? `${base}/${productSlug}` : base;
  return input.promoCode ? `${url}?promo=${encodeURIComponent(input.promoCode)}` : url;
}
