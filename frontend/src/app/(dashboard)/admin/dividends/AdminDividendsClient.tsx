"use client";

import { useState, useEffect } from "react";
import { getDividendCycles, getDividendAllocations, declareDividend, payDividendCycle, DividendCycle, DividendAllocation } from "@/lib/api";
import { formatKES } from "@/lib/utils";
import { Coins, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  groups: { id: string; name: string; groupType: string }[];
  token: string;
}

export function AdminDividendsClient({ groups, token }: Props) {
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [cycles, setCycles] = useState<DividendCycle[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [allocations, setAllocations] = useState<Record<string, DividendAllocation[]>>({});
  const [allocLoading, setAllocLoading] = useState<string | null>(null);

  // Declare form
  const [totalProfit, setTotalProfit] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [declaring, setDeclaring] = useState(false);
  const [declareError, setDeclareError] = useState<string | null>(null);

  const [paying, setPaying] = useState<string | null>(null);

  async function loadCycles(gId: string) {
    setLoading(true);
    try {
      setCycles(await getDividendCycles(token, gId));
    } catch { setCycles([]); }
    setLoading(false);
  }

  useEffect(() => { if (groupId) loadCycles(groupId); }, [groupId]);

  async function toggleAllocations(cycleId: string) {
    if (expanded === cycleId) { setExpanded(null); return; }
    setExpanded(cycleId);
    if (!allocations[cycleId]) {
      setAllocLoading(cycleId);
      try {
        const rows = await getDividendAllocations(token, cycleId);
        setAllocations((a) => ({ ...a, [cycleId]: rows }));
      } catch { }
      setAllocLoading(null);
    }
  }

  async function declare() {
    const profit = parseFloat(totalProfit);
    if (!profit || profit <= 0) { setDeclareError("Enter valid profit amount"); return; }
    setDeclaring(true);
    setDeclareError(null);
    try {
      await declareDividend(token, groupId, profit, parseInt(year));
      setTotalProfit("");
      await loadCycles(groupId);
    } catch (e: any) {
      setDeclareError(e?.detail ?? e?.message ?? "Failed to declare");
    }
    setDeclaring(false);
  }

  async function pay(cycleId: string) {
    setPaying(cycleId);
    try {
      await payDividendCycle(token, cycleId);
      await loadCycles(groupId);
    } catch { }
    setPaying(null);
  }

  if (groups.length === 0) {
    return (
      <div className="border rounded-xl p-12 text-center space-y-3">
        <Coins className="w-10 h-10 text-muted-foreground mx-auto" />
        <p className="font-medium">No SACCO groups found</p>
        <p className="text-muted-foreground text-sm">Dividends apply to SACCO groups only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Group selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">SACCO group</label>
        <select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      {/* Declare form */}
      <div className="border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold">Declare new dividend cycle</h2>
        <div className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Total profit (KES)</label>
            <input
              type="number"
              value={totalProfit}
              onChange={(e) => setTotalProfit(e.target.value)}
              placeholder="e.g. 500000"
              className="border rounded-lg px-3 py-2 text-sm w-44 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Cycle year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm w-24 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={declare}
              disabled={declaring}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {declaring && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Declare
            </button>
          </div>
        </div>
        {declareError && <p className="text-xs text-destructive">{declareError}</p>}
      </div>

      {/* Cycles list */}
      <section className="space-y-3">
        <h2 className="font-semibold">Dividend cycles</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : cycles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cycles declared yet.</p>
        ) : (
          <div className="space-y-2">
            {cycles.map((c) => (
              <div key={c.id} className="border rounded-xl overflow-hidden">
                <div className="p-4 flex items-center gap-4">
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{c.cycleYear} cycle</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        c.status === "PAID" ? "bg-green-100 text-green-700" :
                        c.status === "DECLARED" ? "bg-blue-100 text-blue-700" :
                        "bg-gray-100 text-gray-500"
                      }`}>
                        {c.status.charAt(0) + c.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Total profit: {formatKES(c.totalProfit)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.status === "DECLARED" && (
                      <button
                        onClick={() => pay(c.id)}
                        disabled={paying === c.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
                      >
                        {paying === c.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Pay out
                      </button>
                    )}
                    <button
                      onClick={() => toggleAllocations(c.id)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-accent"
                    >
                      Allocations
                      {expanded === c.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {expanded === c.id && (
                  <div className="border-t bg-muted/30 px-4 py-3">
                    {allocLoading === c.id ? (
                      <p className="text-xs text-muted-foreground py-2">Loading allocations…</p>
                    ) : (allocations[c.id] ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No allocations yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground">
                              <th className="text-left pb-2 pr-4 font-medium">Member</th>
                              <th className="text-right pb-2 pr-4 font-medium tabular-nums">Shares</th>
                              <th className="text-right pb-2 pr-4 font-medium tabular-nums">Amount</th>
                              <th className="text-left pb-2 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allocations[c.id].map((a) => (
                              <tr key={a.id} className="border-t">
                                <td className="py-1.5 pr-4">{a.memberName}</td>
                                <td className="py-1.5 pr-4 text-right tabular-nums">{a.shares.toLocaleString()}</td>
                                <td className="py-1.5 pr-4 text-right tabular-nums">{formatKES(a.amount)}</td>
                                <td className={`py-1.5 font-medium ${a.paid ? "text-green-600" : "text-amber-600"}`}>
                                  {a.paid ? "Paid" : "Pending"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
