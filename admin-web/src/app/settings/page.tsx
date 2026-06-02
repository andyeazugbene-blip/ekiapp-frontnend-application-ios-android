"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";

export default function SettingsPage() {
  const { user } = useAuth();
  const [apiStatus, setApiStatus] = useState<"checking" | "connected" | "error">("checking");

  useEffect(() => {
    checkAPIStatus();
  }, []);

  const checkAPIStatus = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`);
      if (response.ok) {
        setApiStatus("connected");
      } else {
        setApiStatus("error");
      }
    } catch (error) {
      setApiStatus("error");
    }
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            <p className="mt-1 text-sm text-gray-600">Admin panel configuration</p>
          </div>

          {/* Account Info */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-500">Name:</span>
                <span className="text-sm text-gray-900">{user?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-500">Email:</span>
                <span className="text-sm text-gray-900">{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-500">Role:</span>
                <span className="text-sm">
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                    {user?.role}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* API Status */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">API Status</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500">Backend API:</span>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    apiStatus === "connected" ? "bg-green-500" :
                    apiStatus === "error" ? "bg-red-500" :
                    "bg-yellow-500"
                  }`}></div>
                  <span className="text-sm text-gray-900">
                    {apiStatus === "connected" ? "Connected" :
                     apiStatus === "error" ? "Error" :
                     "Checking..."}
                  </span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-500">API URL:</span>
                <span className="text-sm text-gray-900">{process.env.NEXT_PUBLIC_API_URL}</span>
              </div>
              <button
                onClick={checkAPIStatus}
                className="mt-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm"
              >
                Recheck Status
              </button>
            </div>
          </div>

          {/* 2FA Info */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Two-Factor Authentication</h2>
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                2FA is required for sensitive operations such as:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                <li>Issuing refunds</li>
                <li>Resolving disputes</li>
                <li>Reviewing verification documents</li>
                <li>Vendor approval/suspension actions</li>
              </ul>
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm text-blue-700">
                  When 2FA is required, you will be prompted to enter your authentication code.
                  Make sure you have your 2FA app ready.
                </p>
              </div>
            </div>
          </div>

          {/* App Info */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Application Info</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-500">Version:</span>
                <span className="text-sm text-gray-900">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-500">Environment:</span>
                <span className="text-sm text-gray-900">Production</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-500">Build:</span>
                <span className="text-sm text-gray-900">{new Date().toISOString().split('T')[0]}</span>
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
            <h3 className="text-sm font-semibold text-yellow-800 mb-2">Security Notice</h3>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Never share your admin credentials</li>
              <li>• Always log out when finished</li>
              <li>• Report suspicious activity immediately</li>
              <li>• Keep your 2FA device secure</li>
            </ul>
          </div>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
