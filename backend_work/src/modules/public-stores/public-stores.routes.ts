import { Router } from "express";

import { optionalAuthenticate } from "../../middlewares/authenticate";
import { asyncHandler } from "../../shared/utils/async-handler";
import {
  getPublicStore,
  requestGlobalPublicOrderLookup,
  requestPublicStoreOrderLookup,
  trackPublicStoreEvent,
  listPublicStoreProducts,
  verifyGlobalPublicOrderLookup,
  verifyPublicStoreOrderLookup,
} from "./public-stores.controller";

/**
 * Public storefront router — no authentication required.
 * Mounted at /api/public/stores.
 */
export const publicStoresRouter = Router();

publicStoresRouter.post("/order-lookup/request", asyncHandler(requestGlobalPublicOrderLookup));
publicStoresRouter.post("/order-lookup/verify", asyncHandler(verifyGlobalPublicOrderLookup));
publicStoresRouter.get("/:slug", asyncHandler(getPublicStore));
publicStoresRouter.get("/:slug/products", asyncHandler(listPublicStoreProducts));
publicStoresRouter.post("/:slug/events", optionalAuthenticate, asyncHandler(trackPublicStoreEvent));
publicStoresRouter.post("/:slug/order-lookup/request", asyncHandler(requestPublicStoreOrderLookup));
publicStoresRouter.post("/:slug/order-lookup/verify", asyncHandler(verifyPublicStoreOrderLookup));
