import { useEffect, useState } from "react";
import { useAuthStore } from "../stores/authStore";
import { vendorService } from "../services/vendorService";
import type { VendorProfile } from "../types/auth";

/**
 * The vendor-data half of "does this account have a store" — found 19 Oct
 * 2026 via a demo account that genuinely has a Vendor row but, like any
 * dual buyer+seller account, stays role="buyer" (capability-based access
 * is the established pattern everywhere else: role-select.tsx,
 * (vendor)/_layout.tsx). A dozen screens under app/(vendor)/ and
 * app/(vendor-onboarding)/ instead derived their vendor object from
 * `user.role === "vendor" ? user : null` directly — false for exactly
 * that account shape, so every one of them showed "Please log in as a
 * vendor to continue" despite a real store existing.
 *
 * Fast path: a role="vendor" user already IS a VendorProfile (the backend
 * returns the full vendor shape on that login/session) — return it
 * directly, no extra network call for the common case. Slow path: a
 * hasVendor=true account whose role isn't "vendor" needs its real vendor
 * row fetched separately (GET /vendors/me) and shaped to match, since
 * `user` itself is a BuyerProfile with none of these fields.
 */
export function useVendorProfile(): { vendor: VendorProfile | null; loading: boolean } {
  const user = useAuthStore((s) => s.user);
  const isVendorRole = user?.role === "vendor";
  const [fetched, setFetched] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(!isVendorRole && Boolean(user?.hasVendor));

  useEffect(() => {
    if (isVendorRole || !user?.hasVendor) {
      setFetched(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    vendorService
      .getMyProfile()
      .then((p) => {
        if (cancelled) return;
        // Frontend-display shaping only — never a security boundary. The
        // backend always derives the real vendor from the auth token on
        // every write (products.service.ts's getVendorForWrite and
        // equivalents), never from anything this object carries.
        setFetched({
          ...(user as any),
          role: "vendor",
          storeName: p.storeName,
          storeSlug: p.storeSlug,
          shareUrl: p.shareUrl,
          storeDescription: p.description,
          businessType: p.businessType,
          sellerRegion: p.sellerRegion,
          country: p.country,
          city: p.city,
          verificationStatus: p.verificationStatus,
          subscriptionPlan: p.subscriptionPlan,
          rating: p.rating,
          totalReviews: p.totalReviews ?? 0,
          joinedAt: p.joinedAt,
          coverImage: p.coverImage,
          currency: p.currency,
          // VendorSummary carries its own `id` (the Vendor row's id, not
          // the User id) — every screen reading `vendor.id` wants that one
          // (e.g. productService.getVendorProducts(vendor.id)).
          id: p.id,
        } as VendorProfile);
      })
      .catch(() => {
        if (!cancelled) setFetched(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isVendorRole, user?.hasVendor]);

  if (isVendorRole) return { vendor: user as VendorProfile, loading: false };
  return { vendor: fetched, loading };
}
