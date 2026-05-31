import { Product, ProductStatus } from "../types/product";
import { apiClient } from "./api";
import { normalizeProduct, normalizeProducts, toBackendProductInput } from "./api/normalizers";

interface ProductListResponse {
  items?: any[];
  products?: any[];
  nextCursor?: string | null;
  total?: number;
}

interface ProductResponse {
  product: any;
}

interface VendorMeResponse {
  vendor?: any;
}

export const productService = {
  async getAll(params?: { category?: string; vendorId?: string; search?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.category) query.set("category", params.category);
    if (params?.vendorId) query.set("vendorId", params.vendorId);
    if (params?.search) query.set("search", params.search);
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));

    const qs = query.toString();
    const response = await apiClient.get<ProductListResponse>(`/api/products${qs ? `?${qs}` : ""}`, { skipAuth: true });
    return normalizeProducts(response?.items ?? response?.products ?? []);
  },

  async getById(id: string) {
    const response = await apiClient.get<ProductResponse>(`/api/products/${id}`, { skipAuth: true });
    return normalizeProduct(response.product);
  },

  async getVendorProducts(vendorId: string) {
    const response = await apiClient.get<ProductListResponse>(`/api/products?vendorId=${vendorId}`, { skipAuth: true });
    return normalizeProducts(response?.items ?? response?.products ?? []);
  },

  async getMyVendorProducts() {
    const vendorResponse = await apiClient.get<VendorMeResponse>("/api/vendors/me");
    const vendorId = vendorResponse.vendor?.id;
    if (!vendorId) {
      throw new Error("Vendor profile not found.");
    }
    const response = await apiClient.get<ProductListResponse>(`/api/products?vendorId=${vendorId}`, { skipAuth: true });
    return normalizeProducts(response?.items ?? response?.products ?? []);
  },

  async getLowStockProducts(vendorId: string) {
    const response = await apiClient.get<ProductListResponse>(`/api/products?vendorId=${vendorId}&status=low_stock`);
    return normalizeProducts(response?.items ?? response?.products ?? []).filter((p) => p.status === "low_stock" || p.stock <= 5);
  },

  async getHotDeals() {
    const response = await apiClient.get<ProductListResponse>("/api/products?featured=true&limit=3", { skipAuth: true });
    return normalizeProducts(response?.items ?? response?.products ?? []);
  },

  async getPopularProducts() {
    const response = await apiClient.get<ProductListResponse>("/api/products?sort=popular&limit=6", { skipAuth: true });
    return normalizeProducts(response?.items ?? response?.products ?? []);
  },

  async createProduct(payload: Omit<Product, "id" | "createdAt" | "updatedAt">) {
    const response = await apiClient.post<ProductResponse>("/api/products", toBackendProductInput(payload as any));
    return normalizeProduct(response.product);
  },

  async updateProduct(id: string, payload: Partial<Product>) {
    const response = await apiClient.patch<ProductResponse>(`/api/products/${id}`, toBackendProductInput(payload as any));
    return normalizeProduct(response.product);
  },

  async updateStatus(id: string, status: ProductStatus) {
    if (status === "out_of_stock") {
      const res = await apiClient.delete<{ product?: any; success?: boolean; id?: string }>(`/api/products/${id}`);
      return { id: res.id ?? res.product?.id ?? id, status };
    }
    throw new Error("Products disabled by moderation must be re-enabled by an admin.");
  },

  async deleteProduct(id: string) {
    const res = await apiClient.delete<{ product?: any; success?: boolean; id?: string }>(`/api/products/${id}`);
    return { success: res.success ?? true, id: res.id ?? res.product?.id ?? id };
  },
};
