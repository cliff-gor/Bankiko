import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMyDividends, MyDividend } from "@/lib/api";
import { formatKES } from "@/lib/utils";
import { Coins } from "lucide-react";

export default async function DividendsPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken;

  let dividends: MyDividend[] = [];
  try {
    dividends = await getMyDividends(token);
  } catch { /* show empty state */ }

  const pending = dividends.filter((d) => !d.paid);
  const paid    = dividends.filter((d) => d.paid);
  const totalPending = pending.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">My Dividends</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Annual profit-share from SACCO savings and share holdings
        </p>
      </div>

      {dividends.length === 0 ? (
        <div className="border rounded-xl p-12 text-center space-y-3">
          <Coins className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="font-medium">No dividend allocations yet</p>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            When your SACCO admin declares and pays dividends, your allocation will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* Summary card */}
          {totalPending > 0 && (
            <div className="rounded-xl border bg-primary/5 border-primary/20 p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending payout</p>
                <p className="text-2xl font-bold mt-0.5">{formatKES(totalPending)}</p>
              </div>
              <Coins className="w-10 h-10 text-primary/40" />
            </div>
          )}

          {pending.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Pending ({pending.length})
              </h2>
              <div className="space-y-2">
                {pending.map((d) => (
                  <DividendRow key={d.cycleId} d={d} />
                ))}
              </div>
            </section>
          )}

          {paid.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Paid ({paid.length})
              </h2>
              <div className="space-y-2">
                {paid.map((d) => (
                  <DividendRow key={d.cycleId} d={d} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function DividendRow({ d }: { d: MyDividend }) {
  return (
    <div className="border rounded-xl p-4 flex items-center gap-4">
      <div className="flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <p className="font-semibold">{formatKES(d.amount)}</p>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${d.paid ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
            {d.paid ? "Paid" : "Pending"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {d.groupName} · {d.cycleYear} · {d.shares.toLocaleString()} shares
        </p>
      </div>
    </div>
  );
}
