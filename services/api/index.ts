/**
 * API Module — Public exports
 */
export { API_BASE_URL, STRIPE_PUBLISHABLE_KEY } from "./config";
export { apiClient, ApiRequestError, NetworkError, setOnUnauthorized, setApiErrorReporter } from "./client";
export type { ApiResponse, ApiError, HttpMethod } from "./client";
export { tokenStorage } from "./tokenStorage";
export {
  normalizeProduct,
  normalizeProducts,
  normalizeOrder,
  normalizeOrders,
  normalizeOrderStatus,
  toBackendOrderStatus,
  toBackendProductInput,
  normalizeDashboardEarnings,
  mapUploadCategory,
  normalizePayoutRequest,
} from "./normalizers";
