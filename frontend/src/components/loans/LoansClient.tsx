"use client";

import { useState, useEffect } from "react";
import { getLoanSchedule, getLoans } from "@/lib/api";
import { LoanResponse, LoanRepayment } from "@/types";
import { RepayDialog } from "./RepayDialog";
import { formatKES } from "@/lib/utils";
import { ChevronDown, ChevronUp, CheckCircle2, Clock, AlertCircle } from "lucide-react";

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

const INST_ICON: Record<string, React.ReactNode> = {
  PAID:    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />,
  PENDING: <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />,
  OVERDUE: <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />,
};
const INST_ROW: Record<string, string> = {
  PAID:    "opacity-60",
  PENDING: "",
  OVERDUE: "bg-red-50",
};

interface Props {
  loans: LoanResponse[];
  token: string;
}

export function LoansClient({ loans: initial, token }: Props) {
  const [loans, setLoans] = useState<LoanResponse[]>(initial);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<Record<string, LoanRepayment[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Sync when server re-renders with new data
  useEffect(() => { setLoans(initial); }, [initial]);

  async function toggleSchedule(loanId: string) {
    if (expanded === loanId) { setExpanded(null); return; }
    setExpanded(loanId);
    if (!schedules[loanId]) {
      setLoadingId(loanId);
      try {
        const rows = await getLoanSchedule(token, loanId);
        setSchedules((s) => ({ ...s, [loanId]: rows }));
      } catch {}
      setLoadingId(null);
    }
  }

  // After repayment: re-fetch the loans list from the server to get updated balances
  async function handleRepayDone(loanId: string, amountPaid: number) {
    try {
      const fresh = await getLoans(token);
      setLoans(fresh);
      // Refresh schedule if it was open
      if (expanded === loanId) {
        const rows = await getLoanSchedule(token, loanId);
        setSchedules((s) => ({ ...s, [loanId]: rows }));
      }
    } catch {}
  }

  return (
    <div className="space-y-2">
      {loans.map((l) => {
        const totalAmount = l.principal + (l.totalInterest ?? 0);
        const hasBalance = l.outstandingBalance != null;
        const outstanding = l.outstandingBalance ?? 0;
        const paid = Math.max(0, totalAmount - outstanding);
        const pct = totalAmount > 0 ? Math.round((paid / totalAmount) * 100) : 0;

        return (
          <div key={l.id} className="border rounded-xl overflow-hidden">
            <div className="p-4 flex items-center gap-4">
              <div className="flex-1 space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold">{formatKES(l.principal)}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[l.status] ?? "bg-gray-100 text-gray-500"}`}>
                    {STATUS_LABEL[l.status] ?? l.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {l.groupName} · {l.repaymentMonths} months{l.purpose ? ` · ${l.purpose}` : ""}
                </p>
                {l.disbursedAt && (
                  <p className="text-xs text-muted-foreground">
                    Disbursed {new Date(l.disbursedAt).toLocaleDateString("en-KE")}
                  </p>
                )}

                {/* Repayment progress — active loans with known balance */}
                {l.status === "ACTIVE" && hasBalance && (
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        Paid <span className="font-medium text-foreground tabular-nums">{formatKES(paid)}</span>
                        {" "}of {formatKES(totalAmount)}
                      </span>
                      <span className={`font-medium ${pct === 100 ? "text-green-600" : "text-muted-foreground"}`}>
                        {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs font-medium text-amber-600">
                      Outstanding: {formatKES(outstanding)}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {l.status === "ACTIVE" && (
                  <RepayDialog
                    loanId={l.id}
                    groupName={l.groupName}
                    principal={l.principal}
                    outstandingBalance={l.outstandingBalance ?? undefined}
                    token={token}
                    onDone={() => handleRepayDone(l.id, 0)}
                  />
                )}
                {(l.status === "ACTIVE" || l.status === "CLOSED") && (
                  <button
                    onClick={() => toggleSchedule(l.id)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-accent"
                  >
                    Schedule
                    {expanded === l.id
                      ? <ChevronUp className="w-3.5 h-3.5" />
                      : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>

            {expanded === l.id && (
              <div className="border-t bg-muted/30 px-4 py-3">
                {loadingId === l.id ? (
                  <p className="text-xs text-muted-foreground py-2">Loading schedule…</p>
                ) : (schedules[l.id] ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No installments found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground">
                          <th className="text-left pb-2 pr-4 font-medium">#</th>
                          <th className="text-left pb-2 pr-4 font-medium">Due date</th>
                          <th className="text-right pb-2 pr-4 font-medium tabular-nums">Due</th>
                          <th className="text-right pb-2 pr-4 font-medium tabular-nums">Paid</th>
                          <th className="text-left pb-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schedules[l.id].map((inst) => (
                          <tr key={inst.id} className={`border-t ${INST_ROW[inst.status] ?? ""}`}>
                            <td className="py-1.5 pr-4 text-muted-foreground">{inst.installmentNo}</td>
                            <td className="py-1.5 pr-4">{new Date(inst.dueDate).toLocaleDateString("en-KE")}</td>
                            <td className="py-1.5 pr-4 text-right tabular-nums">{formatKES(inst.amountDue)}</td>
                            <td className="py-1.5 pr-4 text-right tabular-nums">{formatKES(inst.amountPaid)}</td>
                            <td className="py-1.5 flex items-center gap-1">
                              {INST_ICON[inst.status]}
                              {inst.status.charAt(0) + inst.status.slice(1).toLowerCase()}
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
        );
      })}
    </div>
  );
}
