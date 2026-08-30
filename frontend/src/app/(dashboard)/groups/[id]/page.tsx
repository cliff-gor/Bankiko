import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGroup, getGroupContributions } from "@/lib/api";
import { formatKES, formatDate } from "@/lib/utils";
import { Users, Calendar, TrendingUp, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ContributeDialog } from "@/components/groups/ContributeDialog";

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken;

  let group = null;
  let contributions = null;
  try {
    [group, contributions] = await Promise.all([
      getGroup(token, id),
      getGroupContributions(token, id),
    ]);
  } catch {}

  if (!group) {
    return (
      <div className="space-y-4">
        <Link href="/groups" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Groups
        </Link>
        <div className="border rounded-xl p-12 text-center">
          <p className="text-muted-foreground">Group not found or you don&apos;t have access.</p>
        </div>
      </div>
    );
  }

  const statusColor =
    group.status === "ACTIVE" ? "bg-green-100 text-green-700" :
    group.status === "SUSPENDED" ? "bg-amber-100 text-amber-700" :
    "bg-gray-100 text-gray-600";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/groups" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Groups
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{group.name}</h1>
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusColor}`}>
              {group.status}
            </span>
          </div>
          {group.description && (
            <p className="text-muted-foreground text-sm">{group.description}</p>
          )}
        </div>
        <ContributeDialog groupId={group.id} groupName={group.name} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="border rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium">Monthly Target</span>
          </div>
          <p className="text-xl font-bold">{formatKES(group.monthlyContributionTarget)}</p>
        </div>
        <div className="border rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="w-4 h-4" />
            <span className="text-xs font-medium">Members</span>
          </div>
          <p className="text-xl font-bold">{group.memberCount}</p>
        </div>
        <div className="border rounded-xl p-4 space-y-2 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span className="text-xs font-medium">Due Day</span>
          </div>
          <p className="text-xl font-bold">{group.contributionDueDay}<span className="text-sm font-normal text-muted-foreground">th of month</span></p>
        </div>
      </div>

      {/* Contributions */}
      <div className="space-y-3">
        <h2 className="font-semibold">Contribution History</h2>
        {!contributions || contributions.content.length === 0 ? (
          <div className="border rounded-xl p-8 text-center">
            <p className="text-muted-foreground text-sm">No contributions recorded yet.</p>
          </div>
        ) : (
          <div className="border rounded-xl divide-y overflow-hidden">
            {contributions.content.map((c) => (
              <div key={c.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                  {c.memberName.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.memberName}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(c.paidAt)}</p>
                </div>
                <p className="font-semibold text-sm text-emerald-600">{formatKES(c.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">Created {formatDate(group.createdAt)}</p>
    </div>
  );
}
