"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export function UserActions({ userId, enabled, role }: { userId: string; enabled: boolean; role: string }) {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken;
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

  async function call(path: string, method = "PUT", body?: object) {
    setLoading(true);
    try {
      await fetch(`${BASE}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button
        disabled={loading}
        onClick={() => call(`/api/admin/users/${userId}/${enabled ? "disable" : "enable"}`)}
        className={`text-xs px-2 py-1 rounded-md font-medium transition-colors disabled:opacity-50 ${
          enabled
            ? "text-red-600 hover:bg-red-50 border border-red-200"
            : "text-green-600 hover:bg-green-50 border border-green-200"
        }`}
      >
        {enabled ? "Disable" : "Enable"}
      </button>
      {role !== "SYSTEM_ADMIN" && (
        <button
          disabled={loading}
          onClick={() => call(`/api/admin/users/${userId}/role`, "PUT", { role: "SYSTEM_ADMIN" })}
          className="text-xs px-2 py-1 rounded-md font-medium text-purple-600 hover:bg-purple-50 border border-purple-200 transition-colors disabled:opacity-50"
        >
          Make Admin
        </button>
      )}
      {role === "SYSTEM_ADMIN" && (
        <button
          disabled={loading}
          onClick={() => call(`/api/admin/users/${userId}/role`, "PUT", { role: "MEMBER" })}
          className="text-xs px-2 py-1 rounded-md font-medium text-gray-500 hover:bg-gray-50 border border-gray-200 transition-colors disabled:opacity-50"
        >
          Demote
        </button>
      )}
    </div>
  );
}
