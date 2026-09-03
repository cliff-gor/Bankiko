import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminGroups } from "@/lib/api";
import { SasraReportsClient } from "./SasraReportsClient";

export default async function SasraReportsPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken;

  let groups: { id: string; name: string }[] = [];
  try {
    const raw = await getAdminGroups(token);
    groups = raw.filter((g) => g.groupType === "SACCO");
  } catch { /* show empty */ }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">SASRA Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate monthly returns for SACCO regulatory filing
        </p>
      </div>
      <SasraReportsClient groups={groups} token={token} />
    </div>
  );
}
