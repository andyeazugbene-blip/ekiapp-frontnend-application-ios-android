import { apiClient } from "../api";
import {
  VerificationDocument,
  VerificationQueueItem,
  VerificationReviewDetails,
  VerificationStatus,
} from "@/types";

function normalizeDocument(raw: any): VerificationDocument {
  const type = (raw.type ?? "").toString().toLowerCase();
  return {
    id: raw.id,
    vendorId: raw.vendorId,
    vendorName: raw.vendor?.storeName ?? raw.vendorName ?? "",
    type: type.includes("business") ? "business" : type.includes("selfie") ? "selfie" : "id",
    status: (raw.status ?? "pending").toString().toLowerCase() as VerificationStatus,
    fileUrl: raw.frontReadUrl ?? raw.fileUrl ?? raw.frontUrl ?? "",
    frontReadUrl: raw.frontReadUrl,
    backReadUrl: raw.backReadUrl,
    frontUrl: raw.frontUrl,
    backUrl: raw.backUrl,
    submittedAt: raw.createdAt ?? raw.submittedAt ?? "",
    reviewedAt: raw.reviewedAt,
    reviewedById: raw.reviewedById,
    reviewNote: raw.reviewNote ?? raw.rejectionReason,
    rejectionReason: raw.rejectionReason,
    deleteAfterAt: raw.deleteAfterAt,
    deletedAt: raw.deletedAt,
  };
}

function normalizeStatus(raw: any): "PENDING" | "VERIFIED" | "REJECTED" {
  const value = (raw ?? "PENDING").toString().toUpperCase();
  if (value === "VERIFIED" || value === "APPROVED") return "VERIFIED";
  if (value === "REJECTED") return "REJECTED";
  return "PENDING";
}

function normalizeQueueItem(raw: any): VerificationQueueItem {
  return {
    vendorId: raw.vendorId,
    storeName: raw.storeName ?? "",
    vendorName: raw.vendorName ?? "",
    email: raw.email ?? "",
    phone: raw.phone ?? "",
    verificationStatus: normalizeStatus(raw.verificationStatus),
    latestSubmissionDate: raw.latestSubmissionDate ?? raw.latestSubmissionAt ?? raw.createdAt ?? "",
    uploadedDocSummary: {
      governmentId: raw.uploadedDocSummary?.governmentId ?? 0,
      businessRegistration: raw.uploadedDocSummary?.businessRegistration ?? 0,
      selfie: raw.uploadedDocSummary?.selfie ?? 0,
      total: raw.uploadedDocSummary?.total ?? 0,
    },
    docsAlreadyDeleted: Boolean(raw.docsAlreadyDeleted),
  };
}

function normalizeDetails(raw: any): VerificationReviewDetails {
  return {
    vendor: {
      ...raw.vendor,
      verificationStatus: normalizeStatus(raw.vendor?.verificationStatus ?? raw.verificationStatus),
    },
    verificationStatus: normalizeStatus(raw.verificationStatus),
    uploadedDocSummary: {
      governmentId: raw.uploadedDocSummary?.governmentId ?? 0,
      businessRegistration: raw.uploadedDocSummary?.businessRegistration ?? 0,
      selfie: raw.uploadedDocSummary?.selfie ?? 0,
      total: raw.uploadedDocSummary?.total ?? 0,
    },
    docsAlreadyDeleted: Boolean(raw.docsAlreadyDeleted),
    latestSubmissionDate: raw.latestSubmissionDate,
    reviewedAt: raw.reviewedAt,
    reviewedBy: raw.reviewedBy,
    rejectionReason: raw.rejectionReason,
    proofs: (raw.proofs ?? []).map(normalizeDocument),
  };
}

export const verificationAPI = {
  async getQueue(params?: {
    search?: string;
    status?: "all" | "pending" | "verified" | "rejected";
    page?: number;
    limit?: number;
  }): Promise<{ items: VerificationQueueItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.status && params.status !== "all") query.set("status", params.status);
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    const res = await apiClient.get<any>(`/admin/verifications?${query.toString()}`, { bypassCache: true });
    return {
      items: (res.items ?? []).map(normalizeQueueItem),
      pagination: res.pagination ?? { page: params?.page ?? 1, limit: params?.limit ?? 20, total: 0, totalPages: 0 },
    };
  },

  async getReview(vendorId: string): Promise<VerificationReviewDetails> {
    const res = await apiClient.get<any>(`/admin/verifications/${vendorId}`, { bypassCache: true });
    return normalizeDetails(res);
  },

  async approveVendor(vendorId: string): Promise<VerificationReviewDetails> {
    const res = await apiClient.patch<any>(`/admin/verifications/${vendorId}/approve`, {});
    return normalizeDetails(res);
  },

  async rejectVendor(vendorId: string, rejectionReason: string): Promise<VerificationReviewDetails> {
    const res = await apiClient.patch<any>(`/admin/verifications/${vendorId}/reject`, { rejectionReason });
    return normalizeDetails(res);
  },

  async deleteFilesNow(vendorId: string): Promise<{ deletedDocuments: number; failedDocuments: number }> {
    return apiClient.delete(`/admin/verifications/${vendorId}/files`);
  },

  async getDocuments(status?: VerificationStatus): Promise<VerificationDocument[]> {
    const query = status ? `?status=${encodeURIComponent(status.toUpperCase())}` : "";
    const res = await apiClient.get<any>(`/admin/verification-documents${query}`);
    return (res.items ?? res.documents ?? []).map(normalizeDocument);
  },

  async reviewDocument(
    docId: string,
    decision: "approved" | "rejected",
    note?: string,
    twoFactorCode?: string
  ): Promise<void> {
    await apiClient.patch(
      `/admin/verification-documents/${docId}/review`,
      { status: decision.toUpperCase(), rejectionReason: decision === "rejected" ? note : undefined },
      { twoFactorCode }
    );
  },
};
