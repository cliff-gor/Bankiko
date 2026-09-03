"use client";

import { useState } from "react";
import { updateGroupLoanRules } from "@/lib/api";
import { GroupResponse } from "@/types";
import { Settings2, Loader2, Check } from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
  group: GroupResponse;
  token: string;
}

export function LoanRulesPanel({ group, token }: Props) {
  const router = useRouter();
  const isSacco = group.groupType === "SACCO";

  const [rate, setRate]     = useState(String(group.annualInterestRate ?? "12"));
  const [type, setType]     = useState<"REDUCING_BALANCE" | "FLAT_RATE">(
    (group.interestType as any) ?? "REDUCING_BALANCE"
  );
  const [multiplier, setMultiplier] = useState(String(group.loanMultiplier ?? "3"));
  const [minMonths, setMinMonths]   = useState(String(group.minContributionsRequired ?? "3"));
  const [penalty, setPenalty]       = useState(String(group.latePenaltyRate ?? "5"));

  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateGroupLoanRules(token, group.id, {
        annualInterestRate: parseFloat(rate),
        interestType: type,
        loanMultiplier: isSacco ? parseInt(multiplier) : undefined,
        minContributionsRequired: parseInt(minMonths),
        latePenaltyRate: parseFloat(penalty),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } catch (e: any) {
      setError(e?.detail ?? e?.message ?? "Failed to save rules");
    }
    setSaving(false);
  }

  return (
    <div className="border rounded-xl p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Settings2 className="w-4 h-4 text-muted-foreground" />
        <h2 className="font-semibold">Loan Rules</h2>
        <span className="text-xs text-muted-foreground">(visible to admins only)</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Interest rate */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Annual interest rate (%)</label>
          <input
            type="number"
            min="0" max="100" step="0.5"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">
            Applied to every loan approved from this group's pool
          </p>
        </div>

        {/* Interest type */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Interest method</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="REDUCING_BALANCE">Reducing balance</option>
            <option value="FLAT_RATE">Flat rate</option>
          </select>
          <p className="text-xs text-muted-foreground">
            {type === "REDUCING_BALANCE"
              ? "Interest calculated on outstanding balance each month"
              : "Interest calculated once on the full principal"}
          </p>
        </div>

        {/* Loan multiplier — SACCO only */}
        {isSacco && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Loan multiplier</label>
            <input
              type="number"
              min="1" max="20"
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              Max loan = shares held × share price × this multiplier
            </p>
          </div>
        )}

        {/* Min contributions */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Min months of contributions before loan
          </label>
          <input
            type="number"
            min="0" max="24"
            value={minMonths}
            onChange={(e) => setMinMonths(e.target.value)}
            className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">
            Set to 0 to allow loans with no contribution history
          </p>
        </div>

        {/* Late penalty rate */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Late payment penalty (%)</label>
          <input
            type="number"
            min="0" max="100" step="0.5"
            value={penalty}
            onChange={(e) => setPenalty(e.target.value)}
            className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">
            % of installment charged on overdue installments
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {saving ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
          ) : saved ? (
            <><Check className="w-3.5 h-3.5" /> Saved</>
          ) : (
            "Save rules"
          )}
        </button>
      </div>
    </div>
  );
}
