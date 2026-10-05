import { apiClient } from "../api";

/**
 * Action Centre, global search and test-record flagging (handbook §2.1, §3).
 * Shapes mirror ekiapp-backend admin-action-centre.service.ts / admin-search.service.ts.
 */

export type Severity = "critical" | "high" | "medium" | "low" | "ok";

export interface MoneyByCurrency {
  currency: string;
  amountMinor: number;
  count: number;
}

export interface SectionItem {
  title: string;
  subtitle?: string;
  href: string;
  at?: string | null;
}

export interface ActionSection {
  key: string;
  title: string;
  description: string;
  state: "ok" | "unavailable" | "not_monitored";
  severity: Severity;
  count: number;
  values: MoneyByCurrency[];
  oldestAt: string | null;
  href: string;
  breakdown: Array<{ label: string; count: number; href?: string }>;
  items: SectionItem[];
  note?: string;
  error?: string;
}

export interface ActionCentreKpis {
  gmv: MoneyByCurrency[];
  paidOrders: number;
  totalOrders: number;
  activeVendors30d: number;
  totalVendors: number;
  totalBuyers: number;
}

export interface ActionCentreData {
  generatedAt: string;
  includeTest: boolean;
  thresholds: Record<string, string>;
  viewerPermissions: string[];
  sections: ActionSection[];
  kpis: ActionCentreKpis | null;
  kpisError?: string;
  badges: Record<string, number>;
}

export type SearchGroupKey = "users" | "vendors" | "orders" | "payments" | "campaigns" | "subscriptions";

export interface SearchResult {
  id: string;
  type: SearchGroupKey;
  title: string;
  subtitle: string;
  href: string;
  isTest?: boolean;
}

export interface SearchResponse {
  query: string;
  groups: Array<{ key: SearchGroupKey; label: string; results: SearchResult[] }>;
  errors: SearchGroupKey[];
  restricted: SearchGroupKey[];
}

export const dashboardAPI = {
  getActionCentre(includeTest = false): Promise<ActionCentreData> {
    const qs = includeTest ? "?includeTest=true" : "";
    return apiClient.get<ActionCentreData>(`/admin/dashboard/action-centre${qs}`, { bypassCache: true });
  },

  search(q: string): Promise<SearchResponse> {
    return apiClient.get<SearchResponse>(`/admin/search?q=${encodeURIComponent(q)}`, { bypassCache: true });
  },

  setTestFlag(
    entity: "users" | "vendors" | "orders",
    id: string,
    isTest: boolean,
    reason: string,
  ): Promise<{ id: string; isTest: boolean; affected: { users: number; vendors: number; orders: number; payments: number } }> {
    return apiClient.patch(`/admin/${entity}/${encodeURIComponent(id)}/test-flag`, { isTest, reason });
  },
};
