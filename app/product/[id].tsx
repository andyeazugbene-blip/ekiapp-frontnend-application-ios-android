import { useEffect, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ErrorState, LoadingBlock, premiumStyles } from "../../components/shared/PremiumBlocks";
import { productService } from "../../services/productService";
import { vendorService } from "../../services/vendorService";

/**
 * Universal/app-link destination for https://culinarytales.app/product/:id.
 *
 * Redirects to the real, existing PUBLIC product page
 * (/store/[slug]/product/[productId]) rather than the authenticated
 * in-app product-detail.tsx — a product link shared outside the app must
 * work for someone who isn't already logged in as a buyer, exactly like
 * /store already does. That screen is public (skipAuth), so no login
 * gate is needed here.
 *
 * productService.getById() only returns vendorId, not the vendor's
 * storeSlug the target route needs, so this does one extra public,
 * unauthenticated lookup (vendorService.getVendorById, skipAuth: true)
 * to resolve it — both calls already exist and are already public; no
 * new backend endpoint is added.
 */
export default function ProductDeepLinkRedirect() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      router.replace("/(buyer)" as any);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const product = await productService.getById(id);
        const vendor = await vendorService.getVendorById(product.vendorId);
        if (cancelled) return;
        if (!vendor.storeSlug) throw new Error("This store isn't available yet.");
        router.replace({ pathname: "/store/[slug]/product/[productId]", params: { slug: vendor.storeSlug, productId: id } } as any);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "This product isn't available.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, router]);

  if (error) {
    return (
      <View style={premiumStyles.page}>
        <View style={premiumStyles.block}>
          <ErrorState title="We couldn't open this product" message={error} onRetry={() => router.replace("/(buyer)" as any)} />
        </View>
      </View>
    );
  }

  return (
    <View style={premiumStyles.page}>
      <LoadingBlock />
    </View>
  );
}
