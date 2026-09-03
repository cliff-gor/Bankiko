import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGroups, getLoans, getPendingLoans } from "@/lib/api";
import { ApplyLoanDialog } from "@/components/loans/ApplyLoanDialog";
import { AdminLoanActions } from "@/components/loans/AdminLoanActions";
import { LoansClient } from "@/components/loans/LoansClient";
import { GroupResponse, LoanResponse } from "@/types";
import { CreditCard } from "lucide-react";
import { formatKES } from "@/lib/utils";

const STATUS_COLOR: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  APPROVED:         "bg-blue-100 text-blue-700",
  ACTIVE:           "bg-green-100 text-green-700",
  CLOSED:           "bg-gray-100 text-gray-500",
  REJECTED:         "bg-red-100 text-red-600",
};
const STATUS_LABEL: Record<string, string> = {
  PENDING_APPROVAL: "Pending",
  APPROVED:         "Approved",
  ACTIVE:           "Active",
  CLOSED:           "Closed",
  REJECTED:         "Rejected",
};

export default async function LoansPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken;
  const role   = (session as any)?.role ?? "";

  let groups: GroupResponse[]  = [];
  let loans: LoanResponse[]    = [];
  let pending: LoanResponse[]  = [];

  const [g, l, p] = await Promise.allSettled([
    getGroups(token),
    getLoans(token),
    role === "SYSTEM_ADMIN" ? getPendingLoans(token) : Promise.resolve([]),
  ]);
  if (g.status === "fulfilled") groups  = g.value.content;
  if (l.status === "fulfilled") loans   = l.value;
  if (p.status === "fulfilled") pending = p.value as LoanResponse[];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Loans</h1>
          <p className="text-muted-foreground text-sm mt-1">Borrow from your group lending pool</p>
        </div>
        {groups.length > 0 && <ApplyLoanDialog groups={groups} />}
      </div>

      {/* Admin: pending approvals */}
      {role === "SYSTEM_ADMIN" && pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Pending approval ({pending.length})</h2>
          <div className="space-y-2">
            {pending.map((l) => (
              <div key={l.id} className="border rounded-xl p-4 flex items-center gap-4">
                <div className="flex-1 space-y-0.5">
                  <p className="font-medium text-sm">{l.groupName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatKES(l.principal)} · {l.repaymentMonths} months
                    {l.purpose ? ` · ${l.purpose}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">Applied {new Date(l.appliedAt).toLocaleDateString("en-KE")}</p>
                </div>
                <AdminLoanActions loanId={l.id} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* My loans */}
      <section className="space-y-3">
        <h2 className="font-semibold">My Loans</h2>
        {loans.length === 0 ? (
          <div className="border rounded-xl p-12 text-center space-y-3">
            <CreditCard className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="font-medium">No loans yet</p>
            <p className="text-muted-foreground text-sm">
              Apply for a loan from one of your group pools.
            </p>
          </div>
        ) : (
          <LoansClient loans={loans} token={token} />
        )}
      </section>
    </div>
  );
}
