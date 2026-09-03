import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { ServerWakingBanner } from "@/components/layout/ServerWakingBanner";
import { getGroups, ServerUnavailableError } from "@/lib/api";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // If the refresh token is exhausted NextAuth sets this error; sign out.
  if ((session as any).error === "RefreshAccessTokenError") {
    redirect("/login?reason=session_expired");
  }

  const token = (session as any)?.accessToken as string | undefined;

  let serverDown = false;
  let hasSacco = false;
  let hasChama = false;

  try {
    const groupPage = token ? await getGroups(token) : null;
    const groups = groupPage?.content ?? [];
    hasSacco = groups.some((g) => g.groupType === "SACCO");
    hasChama = groups.some((g) => g.groupType === "CHAMA");
  } catch (e) {
    if (e instanceof ServerUnavailableError) {
      serverDown = true;
    }
    // Other errors (e.g. no groups yet) — ignore, sidebar just shows base nav
  }

  return (
    <div className="flex min-h-screen bg-background">
      <SessionGuard />
      {serverDown && <ServerWakingBanner />}
      <Sidebar hasSacco={hasSacco} hasChama={hasChama} />
      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
