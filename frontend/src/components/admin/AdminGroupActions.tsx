"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check, X } from "lucide-react";
import { adminApproveGroup, adminRejectGroup } from "@/lib/api";

export function AdminGroupActions({ groupId }: { groupId: string }) {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken;
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);

  async function handle(action: "approve" | "reject") {
    setLoading(action);
    try {
      if (action === "approve") await adminApproveGroup(token, groupId);
      else await adminRejectGroup(token, groupId);
      router.refresh();
    } catch {
      // silent
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handle("approve")}
        disabled={!!loading}
        className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        <Check className="w-3 h-3" />
        {loading === "approve" ? "Approving…" : "Approve"}
      </button>
      <button
        onClick={() => handle("reject")}
        disabled={!!loading}
        className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
      >
        <X className="w-3 h-3" />
        {loading === "reject" ? "Rejecting…" : "Reject"}
      </button>
    </div>
  );
}
