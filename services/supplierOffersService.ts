import { apiClient } from "./api/client";

export type SupplierOfferStatus = "DRAFT" | "IN_REVIEW" | "INFO_REQUIRED" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "SUSPENDED" | "SUPERSEDED";
export type OfferFulfilment = "DELIVERY" | "COLLECTION";

export interface OfferReview {
  id: string;
  status: string;
  submittedAt: string;
  decisionReason: string | null;
  infoMessage: string | null;
}

export interface SupplierOffer {
  id: string;
  foodstuffName: string;
  description: string | null;
  packSize: string;
  images: string[];
  currency: string;
  pricePerShareMinor: number;
  minimumShares: number;
  maximumShares: number;
  windowStartsAt: string;
  windowEndsAt: string;
  fulfilmentMethods: OfferFulfilment[];
  deliveryAreas: string[];
  deliveryFeeMinor: number | null;
  collectionAddressLine1: string | null;
  collectionCity: string | null;
  collectionPostcode: string | null;
  status: SupplierOfferStatus;
  review?: OfferReview | null;
}

export interface SupplierOfferInput {
  foodstuffName: string;
  packSize: string;
  images?: string[];
  pricePerShareMinor: number;
  minimumShares: number;
  maximumShares: number;
  windowStartsAt: string;
  windowEndsAt: string;
  fulfilmentMethods: OfferFulfilment[];
  deliveryAreas?: string[];
  deliveryFeeMinor?: number;
  collectionAddressLine1?: string;
  collectionCity?: string;
  collectionPostcode?: string;
}

/** An approved offer, as organisers see it. */
export interface OfferCard {
  id: string;
  foodstuffName: string;
  description: string | null;
  packSize: string;
  images: string[];
  currency: string;
  pricePerShareMinor: number;
  minimumShares: number;
  maximumShares: number;
  windowEndsAt: string;
  fulfilmentMethods: OfferFulfilment[];
  deliveryAreas: string[];
  deliveryFeeMinor: number | null;
  collectionCity: string | null;
  supplierName: string;
  verifiedSupplier: boolean;
}

export interface OfferCampaign {
  id: string;
  title: string;
  status: string;
  paymentMode: string;
  goalShares: number | null;
  deadline: string | null;
  deliveryPreference: OfferFulfilment;
}

export type OfferCampaignOutcome = "LIVE" | "IN_REVIEW";

export interface SupplierOfferOrder {
  id: string;
  title: string;
  status: string;
  deadline: string | null;
  extensionRequests?: { id: string; requestedDeadline: string; reason: string; supplierReconfirmed: boolean }[];
}

export const supplierOffersService = {
  async listOrders(): Promise<SupplierOfferOrder[]> {
    return (await apiClient.get<{ items: SupplierOfferOrder[] }>("/api/supplier/offer-orders")).items;
  },
  async reconfirmExtension(extensionId: string, canSupply: boolean): Promise<void> {
    await apiClient.post(`/api/supplier/offer-extensions/${extensionId}/reconfirm`, { canSupply });
  },
  async listMine(): Promise<SupplierOffer[]> {
    return (await apiClient.get<{ items: SupplierOffer[] }>("/api/supplier/offers")).items;
  },
  async create(input: SupplierOfferInput): Promise<SupplierOffer> {
    return (await apiClient.post<{ offer: SupplierOffer }>("/api/supplier/offers", input)).offer;
  },
  async update(id: string, input: SupplierOfferInput): Promise<SupplierOffer> {
    return (await apiClient.patch<{ offer: SupplierOffer }>(`/api/supplier/offers/${id}`, input)).offer;
  },
  async submit(id: string): Promise<SupplierOffer> {
    return (await apiClient.post<{ offer: SupplierOffer }>(`/api/supplier/offers/${id}/submit`, {})).offer;
  },
  async withdraw(id: string): Promise<SupplierOffer> {
    return (await apiClient.post<{ offer: SupplierOffer }>(`/api/supplier/offers/${id}/withdraw`, {})).offer;
  },

  async listForOrganisers(): Promise<OfferCard[]> {
    return (await apiClient.get<{ items: OfferCard[] }>("/api/organiser/offers")).items;
  },
  async requestFoodstuff(foodstuff: string): Promise<void> {
    await apiClient.post("/api/organiser/demand-requests", { foodstuff });
  },
  async createCampaign(offerId: string): Promise<OfferCampaign> {
    return (await apiClient.post<{ campaign: OfferCampaign }>("/api/organiser/offer-campaigns", { offerId })).campaign;
  },
  async updateCampaign(id: string, input: { groupName?: string; goalShares?: number; deadline?: string; fulfilmentMethod?: OfferFulfilment }): Promise<OfferCampaign> {
    return (await apiClient.patch<{ campaign: OfferCampaign }>(`/api/organiser/offer-campaigns/${id}`, input)).campaign;
  },
  async submitCampaign(id: string): Promise<{ outcome: OfferCampaignOutcome; campaign: OfferCampaign }> {
    return apiClient.post(`/api/organiser/offer-campaigns/${id}/submit`, {});
  },
  async withdrawCampaign(id: string): Promise<OfferCampaign> {
    return (await apiClient.post<{ campaign: OfferCampaign }>(`/api/organiser/offer-campaigns/${id}/withdraw`, {})).campaign;
  },
  async sendPhoneCode(phone: string): Promise<void> {
    await apiClient.post("/api/organiser/checks/phone/send", { phone });
  },
  async confirmPhoneCode(code: string): Promise<{ missing: string[] }> {
    return apiClient.post("/api/organiser/checks/phone/confirm", { code });
  },
};
