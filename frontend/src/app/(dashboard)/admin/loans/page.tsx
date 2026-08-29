import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminLoans } from "@/lib/api";
import { formatKES } from "@/lib/utils";
import { CreditCard } from "lucide-react";

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

export default async function AdminLoansPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken;

  let loans: Awaited<ReturnType<typeof getAdminLoans>> = [];
  try {
    loans = await getAdminLoans(token);
  } catch {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">All Loans</h1>
        <p className="text-muted-foreground text-sm mt-1">{loans.length} loan{loans.length !== 1 ? "s" : ""} across all members</p>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Member</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Group</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Amount</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Months</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Applied</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loans.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No loans yet
                </td>
              </tr>
            ) : (
              loans.map((l) => (
                <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{l.memberName}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{l.groupName}</td>
                  <td className="px-4 py-3 font-semibold">{formatKES(l.principal)}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{l.repaymentMonths}m</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[l.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {STATUS_LABEL[l.status] ?? l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell text-xs">
                    {new Date(l.appliedAt).toLocaleDateString("en-KE")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
