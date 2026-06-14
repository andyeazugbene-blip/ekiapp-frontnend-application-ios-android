import { apiClient } from "../api";
import { VerificationDocument, VerificationStatus } from "@/types";

function normalizeDocument(raw: any): VerificationDocument {
  const type = (raw.type ?? "").toString().toLowerCase();
  return {
    id: raw.id,
    vendorId: raw.vendorId,
    vendorName: raw.vendor?.storeName ?? raw.vendorName ?? "",
    type: type.includes("business") ? "business" : type.includes("selfie") ? "selfie" : "id",
    status: (raw.status ?? "pending").toString().toLowerCase() as VerificationStatus,
    fileUrl: raw.frontUrl ?? raw.fileUrl ? (raw.frontUrl?.startsWith("http") ? raw.frontUrl : raw.fileUrl?.startsWith("http") ? raw.fileUrl : `https://ekiapp-backend.vercel.app${raw.frontUrl ?? raw.fileUrl}`) : "",
    submittedAt: raw.createdAt ?? raw.submittedAt ?? "",
    reviewedAt: raw.reviewedAt,
    reviewNote: raw.reviewNote ?? raw.rejectionReason,
  };
}

export const verificationAPI = {
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
      { decision: decision.toUpperCase(), note },
      { twoFactorCode }
    );
  },
};
