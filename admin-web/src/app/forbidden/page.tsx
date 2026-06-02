"use client";

import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-red-600">403</h1>
        <h2 className="mt-4 text-2xl font-semibold text-gray-900">Access Denied</h2>
        <p className="mt-2 text-gray-600">
          You do not have permission to access the admin panel.
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Only users with ADMIN role can access this area.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block px-6 py-3 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}
