import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminGroups } from "@/lib/api";
import { AdminDividendsClient } from "./AdminDividendsClient";

export default async function AdminDividendsPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken;

  let groups: { id: string; name: string; groupType: string }[] = [];
  try {
    const raw = await getAdminGroups(token);
    groups = raw.filter((g) => g.groupType === "SACCO");
  } catch { /* show empty state */ }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dividends</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Declare and pay annual dividends to SACCO members
        </p>
      </div>
      <AdminDividendsClient groups={groups} token={token} />
    </div>
  );
}
