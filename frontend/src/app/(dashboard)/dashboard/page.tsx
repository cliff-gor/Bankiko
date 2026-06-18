import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getWalletBalance, getGroups, getMe } from "@/lib/api";
import { formatKES } from "@/lib/utils";
import { Wallet, Users, TrendingUp, ArrowUpRight } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken;

  const [member, balance, groups] = await Promise.allSettled([
    getMe(token),
    getWalletBalance(token),
    getGroups(token),
  ]);

  const memberData  = member.status  === "fulfilled" ? member.value  : null;
  const balanceData = balance.status === "fulfilled" ? balance.value : null;
  const groupsData  = groups.status  === "fulfilled" ? groups.value  : null;

  const needsOnboarding = !memberData || memberData.status === "PENDING_ONBOARDING";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Good day, {session?.user?.name ?? "Member"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Here is your financial overview
        </p>
      </div>

      {needsOnboarding && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">Complete your onboarding</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Activate your wallet to start saving and contributing
            </p>
          </div>
          <Link
            href="/wallet"
            className="flex items-center gap-1 text-primary text-sm font-medium hover:underline"
          >
            Get started <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<Wallet className="w-5 h-5 text-primary" />}
          label="Wallet Balance"
          value={balanceData ? formatKES(balanceData.availableBalance) : "—"}
          sub={balanceData?.accountNo}
          href="/wallet"
        />
        <StatCard
          icon={<Users className="w-5 h-5 text-blue-500" />}
          label="My Groups"
          value={groupsData ? String(groupsData.totalElements) : "—"}
          sub="SACCO groups"
          href="/groups"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
          label="Active Loans"
          value="—"
          sub="View loans"
          href="/loans"
        />
      </div>

      {groupsData && groupsData.content.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">My Groups</h2>
            <Link href="/groups" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {groupsData.content.slice(0, 4).map((g) => (
              <Link
                key={g.id}
                href={`/groups/${g.id}`}
                className="border rounded-xl p-4 hover:bg-accent transition-colors space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{g.name}</span>
                  <span className="text-xs text-muted-foreground">{g.memberCount} members</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Monthly target: {formatKES(g.monthlyContributionTarget)}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub, href }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  href: string;
}) {
  return (
    <Link href={href} className="border rounded-xl p-5 bg-card hover:bg-accent transition-colors space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </Link>
  );
}
