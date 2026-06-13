import { apiClient } from "../api";
import { Product } from "@/types";

function centsToUnit(value: unknown): number {
  return typeof value === "number" ? value / 100 : 0;
}

function normalizeProduct(raw: any): Product {
  return {
    id: raw.id,
    title: raw.title ?? "",
    price: centsToUnit(raw.priceInCents ?? raw.price ?? 0),
    currency: (raw.currency ?? "GBP").toUpperCase(),
    stock: raw.stock ?? 0,
    isActive: raw.isActive ?? false,
    vendorId: raw.vendorId ?? "",
    vendorName: raw.vendorName ?? raw.vendor?.storeName ?? "",
    images: raw.images ?? [],
    createdAt: raw.createdAt ?? "",
  };
}

export const productsAPI = {
  async getProducts(params?: { status?: string }): Promise<Product[]> {
    const query = new URLSearchParams();
    if (params?.status === "active") query.set("isActive", "true");
    if (params?.status === "disabled" || params?.status === "out_of_stock") {
      query.set("isActive", "false");
    }
    query.set("limit", "100");
    const res = await apiClient.get<any>(`/admin/products?${query.toString()}`);
    return (res.items ?? res.products ?? []).map(normalizeProduct);
  },

  async approveProduct(productId: string): Promise<void> {
    await apiClient.patch(`/admin/products/${productId}/approve`, {});
  },

  async disableProduct(productId: string): Promise<void> {
    await apiClient.patch(`/admin/products/${productId}/disable`, {});
  },
};
