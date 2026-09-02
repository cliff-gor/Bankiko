import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminTransactions } from "@/lib/api";
import { formatKES } from "@/lib/utils";
import { Receipt } from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  SUCCESS: "bg-green-100 text-green-700",
  PENDING: "bg-amber-100 text-amber-700",
  FAILED:  "bg-red-100 text-red-600",
  TIMEOUT: "bg-gray-100 text-gray-600",
};

const TYPE_LABEL: Record<string, string> = {
  DEPOSIT:      "Deposit",
  WITHDRAWAL:   "Withdrawal",
  CONTRIBUTION: "Contribution",
};

export default async function AdminTransactionsPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken;

  let transactions: { id: string; userId: string; type: string; amount: number; status: string; mpesaReceiptNumber: string | null; phone: string; createdAt: string }[] = [];
  let total = 0;
  try {
    const data = await getAdminTransactions(token);
    transactions = data.content;
    total = data.totalElements;
  } catch {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Transactions</h1>
        <p className="text-muted-foreground text-sm mt-1">{total} total transactions</p>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Phone</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Amount</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Receipt</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No transactions yet
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium">{TYPE_LABEL[tx.type] ?? tx.type}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{tx.phone}</td>
                  <td className="px-4 py-3">
                    <span className={tx.type === "WITHDRAWAL" ? "text-red-600 font-semibold" : "text-green-700 font-semibold"}>
                      {tx.type === "WITHDRAWAL" ? "-" : "+"}{formatKES(tx.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[tx.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                    {tx.mpesaReceiptNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                    {new Date(tx.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
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
