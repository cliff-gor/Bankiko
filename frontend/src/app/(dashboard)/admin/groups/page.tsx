import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminGroups, AdminGroupSummary } from "@/lib/api";
import { formatKES } from "@/lib/utils";
import { Users } from "lucide-react";
import Link from "next/link";
import { AdminGroupActions } from "@/components/admin/AdminGroupActions";

const TYPE_STYLE: Record<string, string> = {
  CHAMA: "bg-blue-100 text-blue-700",
  SACCO: "bg-purple-100 text-purple-700",
};
const STATUS_STYLE: Record<string, string> = {
  ACTIVE:           "bg-green-100 text-green-700",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  SUSPENDED:        "bg-red-100 text-red-600",
  CLOSED:           "bg-gray-100 text-gray-500",
};

export default async function AdminGroupsPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken;

  let groups: AdminGroupSummary[] = [];
  try {
    groups = await getAdminGroups(token);
  } catch {}

  const pending = groups.filter((g) => g.status === "PENDING_APPROVAL");
  const active  = groups.filter((g) => g.status !== "PENDING_APPROVAL");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Groups</h1>
        <p className="text-muted-foreground text-sm mt-1">{groups.length} group{groups.length !== 1 ? "s" : ""} on the platform</p>
      </div>

      {/* Pending SACCO approvals */}
      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-sm text-amber-700 uppercase tracking-wide">
            Pending approval ({pending.length})
          </h2>
          <div className="border border-amber-200 rounded-xl overflow-hidden bg-amber-50/40">
            <table className="w-full text-sm">
              <thead className="bg-amber-50 border-b border-amber-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Group</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Monthly Target</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Members</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {pending.map((g) => (
                  <tr key={g.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700 text-sm font-bold flex-shrink-0">
                          {g.name[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{g.name}</p>
                          {g.description && <p className="text-xs text-muted-foreground">{g.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{formatKES(g.monthlyContributionTarget)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{g.memberCount}</td>
                    <td className="px-4 py-3"><AdminGroupActions groupId={g.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* All groups */}
      <section className="space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">All groups</h2>
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Group</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Monthly Target</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Members</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {active.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No groups yet
                  </td>
                </tr>
              ) : (
                active.map((g) => (
                  <tr key={g.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
                          {g.name[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{g.name}</p>
                          {g.description && <p className="text-xs text-muted-foreground">{g.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_STYLE[g.groupType] ?? "bg-gray-100 text-gray-600"}`}>
                        {g.groupType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{formatKES(g.monthlyContributionTarget)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{g.memberCount}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[g.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {g.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/groups/${g.id}`} className="text-xs px-3 py-1.5 rounded-md font-medium text-primary hover:bg-primary/10 border border-primary/20 transition-colors">
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
