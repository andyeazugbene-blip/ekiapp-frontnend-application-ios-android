"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { verificationAPI } from "@/lib/services/verification.api";
import { VerificationDocument, VerificationStatus } from "@/types";
import { APIError, API2FARequiredError } from "@/lib/api";

export default function VerificationPage() {
  const [documents, setDocuments] = useState<VerificationDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<VerificationStatus | "all">("pending");
  const [selectedDoc, setSelectedDoc] = useState<VerificationDocument | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [pendingReview, setPendingReview] = useState<{ docId: string; decision: "approved" | "rejected" } | null>(null);

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await verificationAPI.getDocuments(
        statusFilter === "all" ? undefined : statusFilter
      );
      setDocuments(data);
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.message);
      } else {
        setError("Failed to load documents");
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const handleReview = async (docId: string, decision: "approved" | "rejected") => {
    try {
      await verificationAPI.reviewDocument(docId, decision, reviewNote || undefined, twoFactorCode || undefined);
      setSelectedDoc(null);
      setReviewNote("");
      setTwoFactorCode("");
      setShow2FAModal(false);
      await loadDocuments();
    } catch (err) {
      if (err instanceof API2FARequiredError) {
        setPendingReview({ docId, decision });
        setShow2FAModal(true);
      } else if (err instanceof APIError) {
        alert(err.message);
      } else {
        alert("Failed to review document");
      }
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Verification Documents</h1>
            <p className="mt-1 text-sm text-gray-600">Review vendor verification documents</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
              <button onClick={loadDocuments} className="ml-4 underline">Retry</button>
            </div>
          )}

          <div className="bg-white p-4 rounded-lg shadow">
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as VerificationStatus | "all")}
              className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-md text-gray-900"
            >
              <option value="all">All Documents</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            {documents.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No documents found</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{doc.vendorName}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 capitalize">{doc.type}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          doc.status === "approved" ? "bg-green-100 text-green-800" :
                          doc.status === "rejected" ? "bg-red-100 text-red-800" :
                          "bg-yellow-100 text-yellow-800"
                        }`}>
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(doc.submittedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        <button
                          onClick={() => setSelectedDoc(doc)}
                          className="text-primary-600 hover:text-primary-900 font-medium"
                        >
                          Review
                        </button>
                        {doc.fileUrl && (
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-900 font-medium"
                          >
                            View File
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {selectedDoc && (
            <div className="fixed inset-0 z-50 overflow-y-auto">
              <div className="flex items-center justify-center min-h-screen px-4">
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setSelectedDoc(null)}></div>
                <div className="relative bg-white rounded-lg max-w-md w-full p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Review Document</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600">Vendor: <span className="font-medium text-gray-900">{selectedDoc.vendorName}</span></p>
                      <p className="text-sm text-gray-600">Type: <span className="font-medium text-gray-900 capitalize">{selectedDoc.type}</span></p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Review Note (optional)</label>
                      <textarea
                        rows={3}
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                        placeholder="Add a note..."
                      />
                    </div>
                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleReview(selectedDoc.id, "approved")}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReview(selectedDoc.id, "rejected")}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => setSelectedDoc(null)}
                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {show2FAModal && pendingReview && (
            <div className="fixed inset-0 z-50 overflow-y-auto">
              <div className="flex items-center justify-center min-h-screen px-4">
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75"></div>
                <div className="relative bg-white rounded-lg max-w-md w-full p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">2FA Required</h3>
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                      placeholder="Enter 2FA code"
                    />
                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleReview(pendingReview.docId, pendingReview.decision)}
                        className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                      >
                        Submit
                      </button>
                      <button
                        onClick={() => {
                          setShow2FAModal(false);
                          setTwoFactorCode("");
                          setPendingReview(null);
                        }}
                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
