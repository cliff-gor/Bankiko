import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGroups } from "@/lib/api";
import { formatKES, formatDate } from "@/lib/utils";
import { CreateGroupDialog } from "@/components/groups/CreateGroupDialog";
import Link from "next/link";
import { Users, Plus, ChevronRight } from "lucide-react";

export default async function GroupsPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken;

  let groupsData = null;
  try { groupsData = await getGroups(token); } catch {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Groups</h1>
          <p className="text-muted-foreground text-sm mt-1">Your SACCO chama groups</p>
        </div>
        <CreateGroupDialog />
      </div>

      {!groupsData || groupsData.content.length === 0 ? (
        <div className="border rounded-xl p-12 text-center space-y-3">
          <Users className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="font-medium">No groups yet</p>
          <p className="text-muted-foreground text-sm">Create a group or ask an admin to add you.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupsData.content.map((g) => (
            <Link
              key={g.id}
              href={`/groups/${g.id}`}
              className="flex items-center justify-between border rounded-xl p-4 hover:bg-accent transition-colors"
            >
              <div className="space-y-1">
                <p className="font-medium">{g.name}</p>
                <p className="text-xs text-muted-foreground">
                  {g.memberCount} members · Monthly target {formatKES(g.monthlyContributionTarget)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Due day: {g.contributionDueDay}th · Created {formatDate(g.createdAt)}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
