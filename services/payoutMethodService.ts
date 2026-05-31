/**
 * Payout Method Service - vendor saved payout accounts.
 */
import { apiClient } from "./api";

export type PayoutMethodType = "bank" | "stripe" | "paypal";

export interface PayoutMethod {
  id: string;
  type: PayoutMethodType;
  label: string;
  last4?: string;
  email?: string;
  bankName?: string;
  accountHolder?: string;
  country?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PayoutMethodInput {
  type: PayoutMethodType;
  accountNumber?: string;
  bankName?: string;
  accountHolder?: string;
  routingNumber?: string;
  country?: string;
  email?: string;
  isDefault?: boolean;
}

interface PayoutMethodListResponse {
  payoutMethods?: any[];
  methods?: any[];
}

interface PayoutMethodResponse {
  payoutMethod?: any;
  method?: any;
}

const ENDPOINT = "/api/vendors/me/payout-methods";

function toBackendType(type: PayoutMethodType): string {
  return type === "bank" ? "BANK_TRANSFER" : "OTHER";
}

function fromBackendType(type: string | undefined, details: Record<string, any>): PayoutMethodType {
  if (details.provider === "stripe") return "stripe";
  if (details.provider === "paypal") return "paypal";
  return type === "BANK_TRANSFER" ? "bank" : "bank";
}

function toBackendInput(input: PayoutMethodInput): Record<string, unknown> {
  const details =
    input.type === "bank"
      ? {
          accountHolder: input.accountHolder,
          bankName: input.bankName,
          accountNumber: input.accountNumber,
          routingNumber: input.routingNumber,
          country: input.country,
        }
      : {
          provider: input.type,
          email: input.email,
          country: input.country,
        };

  return {
    type: toBackendType(input.type),
    label: input.bankName ?? input.email ?? input.type,
    details,
    isDefault: input.isDefault === true,
  };
}

function normalizeMethod(raw: any): PayoutMethod {
  const details = raw?.details && typeof raw.details === "object" ? raw.details : {};
  const type = fromBackendType(raw?.type, details);
  const accountNumber = typeof details.accountNumber === "string" ? details.accountNumber : "";

  return {
    id: raw?.id ?? "",
    type,
    label: raw?.label ?? details.bankName ?? details.email ?? type,
    last4: accountNumber ? accountNumber.slice(-4) : raw?.last4,
    email: details.email ?? raw?.email,
    bankName: details.bankName ?? raw?.bankName,
    accountHolder: details.accountHolder ?? raw?.accountHolder,
    country: details.country ?? raw?.country,
    isDefault: raw?.isDefault === true,
    createdAt: raw?.createdAt ?? "",
    updatedAt: raw?.updatedAt ?? raw?.createdAt ?? "",
  };
}

function applyDefaultState(methods: PayoutMethod[]): PayoutMethod[] {
  if (methods.length === 0) return [];
  const defaultId = methods.find((item) => item.isDefault)?.id ?? methods[0]?.id;
  return methods.map((item) => ({ ...item, isDefault: item.id === defaultId }));
}

export const payoutMethodService = {
  async list(): Promise<PayoutMethod[]> {
    const res = await apiClient.get<PayoutMethodListResponse>(ENDPOINT);
    return applyDefaultState((res.payoutMethods ?? res.methods ?? []).map(normalizeMethod));
  },

  async create(input: PayoutMethodInput): Promise<PayoutMethod> {
    const res = await apiClient.post<PayoutMethodResponse>(ENDPOINT, toBackendInput(input));
    return normalizeMethod(res.payoutMethod ?? res.method);
  },

  async update(): Promise<PayoutMethod> {
    throw new Error("Editing payout methods is not exposed by the backend yet. Add a new method instead.");
  },

  async setDefault(): Promise<PayoutMethod> {
    throw new Error("Changing the default payout method is not exposed by the backend yet.");
  },

  async remove(): Promise<{ success: true; id: string }> {
    throw new Error("Removing payout methods is not exposed by the backend yet.");
  },
};
