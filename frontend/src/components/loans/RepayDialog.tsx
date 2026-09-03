"use client";

import { useState } from "react";
import { repayLoan } from "@/lib/api";
import { formatKES } from "@/lib/utils";
import { ArrowUpCircle, Loader2, X } from "lucide-react";

interface Props {
  loanId: string;
  groupName: string;
  principal: number;
  outstandingBalance?: number;
  token: string;
  onDone: () => void;
}

export function RepayDialog({ loanId, groupName, principal, outstandingBalance, token, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Enter a valid amount"); return; }
    setLoading(true);
    setError(null);
    try {
      await repayLoan(token, loanId, amt);
      setSuccess(true);
      setTimeout(() => { setOpen(false); setSuccess(false); setAmount(""); onDone(); }, 1500);
    } catch (e: any) {
      setError(e?.detail ?? e?.message ?? "Repayment failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setAmount(""); setError(null); setSuccess(false); }}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
      >
        <ArrowUpCircle className="w-3.5 h-3.5" />
        Repay
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-card w-full max-w-sm rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <h2 className="font-semibold">Make a repayment</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{groupName}</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 rounded-md hover:bg-accent">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Loan summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Principal</p>
                  <p className="font-semibold text-sm mt-0.5">{formatKES(principal)}</p>
                </div>
                {outstandingBalance != null && (
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Outstanding</p>
                    <p className="font-semibold text-sm mt-0.5 text-amber-600">{formatKES(outstandingBalance)}</p>
                  </div>
                )}
              </div>

              {success ? (
                <div className="text-center py-4 text-green-600 font-medium">
                  ✓ Repayment submitted successfully
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Amount (KES)</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="e.g. 5000"
                      className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                      onKeyDown={(e) => e.key === "Enter" && submit()}
                    />
                    {error && <p className="text-xs text-destructive">{error}</p>}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setOpen(false)}
                      className="flex-1 border rounded-lg py-2.5 text-sm font-medium hover:bg-accent transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submit}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
                    >
                      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Submit repayment
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
