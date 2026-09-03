import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { getGroups } from "@/lib/api";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const token = (session as any)?.accessToken as string | undefined;
  const groupPage = token ? await getGroups(token).catch(() => null) : null;
  const groups = groupPage?.content ?? [];
  const hasSacco = groups.some((g) => g.groupType === "SACCO");
  const hasChama = groups.some((g) => g.groupType === "CHAMA");

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar hasSacco={hasSacco} hasChama={hasChama} />
      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
