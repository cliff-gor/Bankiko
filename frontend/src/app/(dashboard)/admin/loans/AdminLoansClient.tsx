"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AdminLoanSummary, getLoanSchedule, markLoanPaid, approveLoan, rejectLoan } from "@/lib/api";
import { LoanRepayment } from "@/types";
import { formatKES } from "@/lib/utils";
import {
  Check, X, CreditCard, ChevronDown, ChevronUp,
  CheckCircle2, Clock, AlertCircle, Loader2, BadgeCheck,
} from "lucide-react";

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

const TABS = ["All", "Pending", "Active", "Closed", "Rejected"] as const;
type Tab = (typeof TABS)[number];

const TAB_FILTER: Record<Tab, string[]> = {
  All:      [],
  Pending:  ["PENDING_APPROVAL", "APPROVED"],
  Active:   ["ACTIVE"],
  Closed:   ["CLOSED"],
  Rejected: ["REJECTED"],
};

const INST_ICON: Record<string, React.ReactNode> = {
  PAID:    <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />,
  PENDING: <Clock className="w-3 h-3 text-amber-500 shrink-0" />,
  OVERDUE: <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />,
};

interface Props {
  loans: AdminLoanSummary[];
  token: string;
}

export function AdminLoansClient({ loans: initial, token }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const sessionToken = (session as any)?.accessToken ?? token;

  const [tab, setTab] = useState<Tab>("All");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<Record<string, LoanRepayment[]>>({});
  const [schedLoading, setSchedLoading] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<{ id: string; action: string } | null>(null);

  const filtered = TAB_FILTER[tab].length
    ? initial.filter((l) => TAB_FILTER[tab].includes(l.status))
    : initial;

  // Tab counts
  const counts = TABS.reduce<Record<Tab, number>>((acc, t) => {
    acc[t] = TAB_FILTER[t].length
      ? initial.filter((l) => TAB_FILTER[t].includes(l.status)).length
      : initial.length;
    return acc;
  }, {} as Record<Tab, number>);

  async function toggleSchedule(loanId: string) {
    if (expanded === loanId) { setExpanded(null); return; }
    setExpanded(loanId);
    if (!schedules[loanId]) {
      setSchedLoading(loanId);
      try {
        const rows = await getLoanSchedule(sessionToken, loanId);
        setSchedules((s) => ({ ...s, [loanId]: rows }));
      } catch {}
      setSchedLoading(null);
    }
  }

  async function handle(loanId: string, action: "approve" | "reject" | "mark-paid") {
    setActionLoading({ id: loanId, action });
    try {
      if (action === "approve")   await approveLoan(sessionToken, loanId);
      else if (action === "reject") await rejectLoan(sessionToken, loanId);
      else                          await markLoanPaid(sessionToken, loanId);
      router.refresh();
    } catch {}
    setActionLoading(null);
  }

  const isLoading = (id: string, action: string) =>
    actionLoading?.id === id && actionLoading?.action === action;

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
            {counts[t] > 0 && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                tab === t ? "bg-primary/10" : "bg-muted"
              }`}>
                {counts[t]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loans list */}
      {filtered.length === 0 ? (
        <div className="border rounded-xl p-12 text-center">
          <CreditCard className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground text-sm">No loans in this category</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((l) => {
            const totalAmount = l.principal + (l.totalInterest ?? 0);
            const outstanding = l.outstandingBalance ?? 0;
            const paid = Math.max(0, totalAmount - outstanding);
            const pct = totalAmount > 0 ? Math.round((paid / totalAmount) * 100) : 0;
            const isActive = l.status === "ACTIVE";
            const isPending = l.status === "PENDING_APPROVAL";

            return (
              <div key={l.id} className="border rounded-xl overflow-hidden">
                {/* Main row */}
                <div className="p-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* Member + group */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{l.memberName}</span>
                      <span className="text-xs text-muted-foreground">· {l.groupName}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[l.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {STATUS_LABEL[l.status] ?? l.status}
                      </span>
                    </div>

                    {/* Amount + terms */}
                    <div className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground tabular-nums">{formatKES(l.principal)}</span>
                      {l.totalInterest != null && l.totalInterest > 0 && (
                        <span> + {formatKES(l.totalInterest)} interest</span>
                      )}
                      <span> · {l.repaymentMonths} months</span>
                      {l.purpose && <span> · {l.purpose}</span>}
                    </div>

                    {/* Dates */}
                    <p className="text-xs text-muted-foreground">
                      Applied {new Date(l.appliedAt).toLocaleDateString("en-KE")}
                      {l.disbursedAt && ` · Disbursed ${new Date(l.disbursedAt).toLocaleDateString("en-KE")}`}
                    </p>

                    {/* Repayment progress (active loans only) */}
                    {isActive && totalAmount > 0 && (
                      <div className="space-y-1 pt-0.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            Paid <span className="text-foreground font-medium tabular-nums">{formatKES(paid)}</span>
                            {" "}of {formatKES(totalAmount)}
                          </span>
                          <span className={`font-medium ${pct === 100 ? "text-green-600" : "text-muted-foreground"}`}>
                            {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-xs text-amber-600 font-medium">
                          Outstanding: {formatKES(outstanding)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-2 shrink-0 items-end">
                    {isPending && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handle(l.id, "approve")}
                          disabled={!!actionLoading}
                          className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          {isLoading(l.id, "approve")
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Check className="w-3 h-3" />}
                          Approve
                        </button>
                        <button
                          onClick={() => handle(l.id, "reject")}
                          disabled={!!actionLoading}
                          className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                        >
                          {isLoading(l.id, "reject")
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <X className="w-3 h-3" />}
                          Reject
                        </button>
                      </div>
                    )}

                    {isActive && (
                      <button
                        onClick={() => handle(l.id, "mark-paid")}
                        disabled={!!actionLoading}
                        className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-50 transition-colors"
                      >
                        {isLoading(l.id, "mark-paid")
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <BadgeCheck className="w-3 h-3" />}
                        Mark as paid
                      </button>
                    )}

                    {(isActive || l.status === "CLOSED") && (
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

                {/* Expandable schedule */}
                {expanded === l.id && (
                  <div className="border-t bg-muted/30 px-4 py-3">
                    {schedLoading === l.id ? (
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
                              <tr
                                key={inst.id}
                                className={`border-t ${
                                  inst.status === "OVERDUE" ? "bg-red-50" :
                                  inst.status === "PAID" ? "opacity-60" : ""
                                }`}
                              >
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
      )}
    </div>
  );
}
