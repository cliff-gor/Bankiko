import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStatement } from "@/lib/api";
import { formatKES } from "@/lib/utils";
import { FileText } from "lucide-react";

const TYPE_STYLE: Record<string, { label: string; color: string; sign: "+" | "-" }> = {
  DEPOSIT:           { label: "Deposit",          color: "text-green-700 bg-green-50",   sign: "+" },
  WITHDRAWAL:        { label: "Withdrawal",        color: "text-red-600 bg-red-50",       sign: "-" },
  CONTRIBUTION:      { label: "Contribution",      color: "text-blue-700 bg-blue-50",     sign: "-" },
  SHARE_PURCHASE:    { label: "Share Purchase",    color: "text-purple-700 bg-purple-50", sign: "-" },
  LOAN_DISBURSEMENT: { label: "Loan Disbursement", color: "text-emerald-700 bg-emerald-50", sign: "+" },
  LOAN_REPAYMENT:    { label: "Loan Repayment",    color: "text-orange-700 bg-orange-50", sign: "-" },
};

export default async function StatementPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken;

  const entries = await getStatement(token).catch(() => []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Statement</h1>
        <p className="text-muted-foreground text-sm mt-1">All financial activity on your account</p>
      </div>

      {entries.length === 0 ? (
        <div className="border rounded-xl p-12 text-center space-y-3">
          <FileText className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="font-medium">No transactions yet</p>
          <p className="text-muted-foreground text-sm">Deposit funds to get started.</p>
        </div>
      ) : (
        <div className="border rounded-xl divide-y overflow-hidden">
          {entries.map((e) => {
            const style = TYPE_STYLE[e.type] ?? { label: e.type, color: "text-gray-600 bg-gray-50", sign: "+" as const };
            return (
              <div key={e.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${style.color}`}>
                  {style.label}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{e.description}</p>
                  {e.reference && (
                    <p className="text-xs text-muted-foreground">Ref: {e.reference}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`font-semibold tabular-nums ${style.sign === "+" ? "text-green-700" : "text-foreground"}`}>
                    {style.sign}{formatKES(e.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {e.createdAt ? new Date(e.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
