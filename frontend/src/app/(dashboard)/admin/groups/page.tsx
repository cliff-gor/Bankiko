import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminGroups } from "@/lib/api";
import { formatKES } from "@/lib/utils";
import { Users } from "lucide-react";
import Link from "next/link";

export default async function AdminGroupsPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken;

  let groups: { id: string; name: string; description: string; monthlyContributionTarget: number; status: string; memberCount: number }[] = [];
  try {
    groups = await getAdminGroups(token);
  } catch {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Groups</h1>
          <p className="text-muted-foreground text-sm mt-1">{groups.length} SACCO groups</p>
        </div>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Group</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Monthly Target</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Members</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {groups.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No groups yet
                </td>
              </tr>
            ) : (
              groups.map((g) => (
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
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{formatKES(g.monthlyContributionTarget)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{g.memberCount}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${g.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {g.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/groups/${g.id}`}
                      className="text-xs px-3 py-1.5 rounded-md font-medium text-primary hover:bg-primary/10 border border-primary/20 transition-colors"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
