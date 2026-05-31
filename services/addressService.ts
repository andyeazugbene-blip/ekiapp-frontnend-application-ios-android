/**
 * Address service for buyer saved delivery addresses.
 */
import { apiClient } from "./api";

export interface SavedAddress {
  id: string;
  recipientName: string;
  line1: string;
  line2?: string;
  city: string;
  postalCode: string;
  country: string;
  phone?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AddressInput = Omit<SavedAddress, "id" | "createdAt" | "updatedAt">;

interface AddressListResponse {
  addresses?: SavedAddress[];
  items?: SavedAddress[];
}

interface AddressResponse {
  address: SavedAddress;
}

export const addressService = {
  async getAddresses(): Promise<SavedAddress[]> {
    const res = await apiClient.get<AddressListResponse>("/api/addresses");
    return res.addresses ?? res.items ?? [];
  },

  async createAddress(input: AddressInput): Promise<SavedAddress> {
    const res = await apiClient.post<AddressResponse>("/api/addresses", input);
    return res.address;
  },

  async updateAddress(id: string, patch: Partial<AddressInput>): Promise<SavedAddress> {
    const res = await apiClient.patch<AddressResponse>(`/api/addresses/${id}`, patch);
    return res.address;
  },

  async deleteAddress(id: string): Promise<void> {
    await apiClient.delete<void>(`/api/addresses/${id}`);
  },

  async setDefault(id: string): Promise<SavedAddress> {
    return this.updateAddress(id, { isDefault: true });
  },
};
