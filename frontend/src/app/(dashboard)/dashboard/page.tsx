import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getWalletBalance, getGroups, getMe, getLoans, getPendingLoans, getAdminUsers } from "@/lib/api";
import { formatKES } from "@/lib/utils";
import { Wallet, Users, TrendingUp, ArrowUpRight, ShieldCheck, Clock } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken;
  const isAdmin = (session as any)?.role === "SYSTEM_ADMIN";

  if (isAdmin) {
    return <AdminDashboard token={token} session={session} />;
  }
  return <MemberDashboard token={token} session={session} />;
}

async function AdminDashboard({ token, session }: { token: string; session: any }) {
  const [usersRes, groupsRes, pendingRes, loansRes] = await Promise.allSettled([
    getAdminUsers(token),
    getGroups(token),
    getPendingLoans(token),
    getLoans(token),
  ]);

  const users   = usersRes.status   === "fulfilled" ? usersRes.value   : null;
  const groups  = groupsRes.status  === "fulfilled" ? groupsRes.value  : null;
  const pending = pendingRes.status === "fulfilled" ? pendingRes.value : [];
  const loans   = loansRes.status   === "fulfilled" ? loansRes.value   : [];
  const activeLoans = loans.filter((l) => l.status === "ACTIVE").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Good day, {session?.user?.name ?? "Admin"} — platform overview
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5" /> System Admin
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={<Users className="w-5 h-5 text-blue-500" />}
          label="Total Members" value={users ? String(users.totalElements) : "—"}
          sub="Registered users" href="/admin/users" />
        <StatCard icon={<Users className="w-5 h-5 text-emerald-500" />}
          label="Groups" value={groups ? String(groups.totalElements) : "—"}
          sub="SACCO groups" href="/groups" />
        <StatCard icon={<Clock className="w-5 h-5 text-amber-500" />}
          label="Pending Loans" value={String(pending.length)}
          sub="Awaiting approval" href="/loans" highlight={pending.length > 0} />
        <StatCard icon={<TrendingUp className="w-5 h-5 text-primary" />}
          label="Active Loans" value={String(activeLoans)}
          sub="Disbursed loans" href="/loans" />
      </div>

      {/* Pending loan approvals */}
      {pending.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Pending Loan Approvals</h2>
            <Link href="/loans" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          <div className="border rounded-xl divide-y overflow-hidden">
            {pending.slice(0, 5).map((l) => (
              <div key={l.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex-1">
                  <p className="font-medium text-sm">{l.groupName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatKES(l.principal)} · {l.repaymentMonths}mo
                    {l.purpose ? ` · ${l.purpose}` : ""}
                  </p>
                </div>
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">Pending</span>
                <Link href="/loans" className="text-xs text-primary font-medium hover:underline">Review →</Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent members */}
      {users && users.content.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent Members</h2>
            <Link href="/admin/users" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          <div className="border rounded-xl divide-y overflow-hidden">
            {users.content.slice(0, 5).map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                  {u.fullName.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{u.fullName}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.enabled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                  {u.enabled ? "Active" : "Disabled"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

async function MemberDashboard({ token, session }: { token: string; session: any }) {
  const [member, balance, groups, loans] = await Promise.allSettled([
    getMe(token),
    getWalletBalance(token),
    getGroups(token),
    getLoans(token),
  ]);

  const memberData  = member.status  === "fulfilled" ? member.value  : null;
  const balanceData = balance.status === "fulfilled" ? balance.value : null;
  const groupsData  = groups.status  === "fulfilled" ? groups.value  : null;
  const loansData   = loans.status   === "fulfilled" ? loans.value   : null;
  const activeLoans = loansData?.filter((l) => l.status === "ACTIVE").length ?? 0;
  const needsOnboarding = !memberData || memberData.status === "PENDING_ONBOARDING";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Good day, {session?.user?.name ?? "Member"}</h1>
        <p className="text-muted-foreground text-sm mt-1">Here is your financial overview</p>
      </div>

      {needsOnboarding && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">Complete your onboarding</p>
            <p className="text-muted-foreground text-xs mt-0.5">Activate your wallet to start saving and contributing</p>
          </div>
          <Link href="/wallet" className="flex items-center gap-1 text-primary text-sm font-medium hover:underline">
            Get started <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<Wallet className="w-5 h-5 text-primary" />}
          label="Wallet Balance" value={balanceData ? formatKES(balanceData.availableBalance) : "—"}
          sub={balanceData?.accountNo} href="/wallet" />
        <StatCard icon={<Users className="w-5 h-5 text-blue-500" />}
          label="My Groups" value={groupsData ? String(groupsData.totalElements) : "—"}
          sub="SACCO groups" href="/groups" />
        <StatCard icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
          label="Active Loans" value={loansData !== null ? String(activeLoans) : "—"}
          sub="View loans" href="/loans" />
      </div>

      {groupsData && groupsData.content.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">My Groups</h2>
            <Link href="/groups" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {groupsData.content.slice(0, 4).map((g) => (
              <Link key={g.id} href={`/groups/${g.id}`}
                className="border rounded-xl p-4 hover:bg-accent transition-colors space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{g.name}</span>
                  <span className="text-xs text-muted-foreground">{g.memberCount} members</span>
                </div>
                <p className="text-xs text-muted-foreground">Monthly target: {formatKES(g.monthlyContributionTarget)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub, href, highlight }: {
  icon: React.ReactNode; label: string; value: string;
  sub?: string; href: string; highlight?: boolean;
}) {
  return (
    <Link href={href} className={`border rounded-xl p-5 bg-card hover:bg-accent transition-colors space-y-3 ${highlight ? "border-amber-300 bg-amber-50/50" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </Link>
  );
}
