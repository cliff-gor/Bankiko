import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGroups } from "@/lib/api";
import { ApplyLoanDialog } from "@/components/loans/ApplyLoanDialog";
import { CreditCard } from "lucide-react";
import { GroupResponse } from "@/types";

export default async function LoansPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken;

  let groups: GroupResponse[] = [];
  try {
    const data = await getGroups(token);
    groups = data.content;
  } catch {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Loans</h1>
          <p className="text-muted-foreground text-sm mt-1">Borrow from your group lending pool</p>
        </div>
        {groups.length > 0 && <ApplyLoanDialog groups={groups} />}
      </div>

      <div className="border rounded-xl p-12 text-center space-y-3">
        <CreditCard className="w-10 h-10 text-muted-foreground mx-auto" />
        <p className="font-medium">No active loans</p>
        <p className="text-muted-foreground text-sm">
          Apply for a loan from one of your group pools.
        </p>
      </div>
    </div>
  );
}
