import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminGroups, getShareRegister } from "@/lib/api";
import { formatKES } from "@/lib/utils";
import { AdminGroupSummary, ShareHoldingResponse } from "@/types";

export default async function AdminSharesPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken;

  const groups = await getAdminGroups(token).catch(() => [] as AdminGroupSummary[]);
  const saccoGroups = groups.filter((g) => g.groupType === "SACCO" && g.status === "ACTIVE");

  // Fetch register for each SACCO group in parallel
  const registers = await Promise.all(
    saccoGroups.map((g) =>
      getShareRegister(token, g.id)
        .then((r) => ({ group: g, holdings: r }))
        .catch(() => ({ group: g, holdings: [] as ShareHoldingResponse[] }))
    )
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Share Register</h1>
        <p className="text-muted-foreground text-sm mt-1">Share holdings across all active SACCO groups</p>
      </div>

      {registers.length === 0 && (
        <div className="border rounded-xl p-12 text-center text-muted-foreground">
          No active SACCO groups yet.
        </div>
      )}

      {registers.map(({ group, holdings }) => (
        <section key={group.id} className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-lg">{group.name}</h2>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">SACCO</span>
            <span className="text-xs text-muted-foreground">{holdings.length} holders</span>
          </div>

          {holdings.length === 0 ? (
            <p className="text-sm text-muted-foreground border rounded-xl p-6 text-center">
              No shares purchased yet in this group.
            </p>
          ) : (
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Member</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Shares</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Invested</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Max Loan</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {holdings.map((h, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{h.memberName ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{h.sharesHeld.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatKES(h.totalInvested)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-green-700 font-medium">
                        {formatKES(h.maxLoanEligible)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/30 border-t">
                  <tr>
                    <td className="px-4 py-2 text-sm font-semibold text-muted-foreground">Total</td>
                    <td className="px-4 py-2 text-right font-bold tabular-nums">
                      {holdings.reduce((s, h) => s + h.sharesHeld, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right font-bold tabular-nums">
                      {formatKES(holdings.reduce((s, h) => s + h.totalInvested, 0))}
                    </td>
                    <td className="px-4 py-2 text-right font-bold tabular-nums text-green-700">
                      {formatKES(holdings.reduce((s, h) => s + h.maxLoanEligible, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
