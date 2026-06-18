"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { initiateDeposit, initiateWithdraw } from "@/lib/api";

const schema = z.object({
  amount: z.coerce.number().min(10, "Minimum amount is KES 10"),
  phone: z.string().regex(/^(\+254|0)[17]\d{8}$/, "Enter a valid Kenyan phone number"),
  remarks: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function WalletActions({ phone }: { phone: string }) {
  const { data: session } = useSession();
  const [mode, setMode] = useState<"deposit" | "withdraw" | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { phone },
  });

  async function onSubmit(data: FormData) {
    const token = (session as any)?.accessToken;
    setLoading(true);
    try {
      if (mode === "deposit") {
        await initiateDeposit(token, data.amount, data.phone);
        toast.success("STK push sent — check your phone and enter your M-Pesa PIN");
      } else {
        await initiateWithdraw(token, data.amount, data.phone, data.remarks);
        toast.success("Withdrawal initiated — funds will arrive on your M-Pesa shortly");
      }
      reset({ phone });
      setMode(null);
    } catch (err: any) {
      toast.error(err?.detail ?? "Transaction failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setMode(mode === "deposit" ? null : "deposit")}
          className="flex items-center justify-center gap-2 border rounded-xl py-3 text-sm font-medium hover:bg-accent transition-colors"
        >
          <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
          Deposit
        </button>
        <button
          onClick={() => setMode(mode === "withdraw" ? null : "withdraw")}
          className="flex items-center justify-center gap-2 border rounded-xl py-3 text-sm font-medium hover:bg-accent transition-colors"
        >
          <ArrowUpRight className="w-4 h-4 text-blue-500" />
          Withdraw
        </button>
      </div>

      {mode && (
        <div className="border rounded-xl p-5 space-y-4">
          <h3 className="font-medium">{mode === "deposit" ? "Deposit via M-Pesa" : "Withdraw to M-Pesa"}</h3>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Amount (KES)</label>
              <input
                {...register("amount")}
                type="number"
                placeholder="500"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
              />
              {errors.amount && <p className="text-destructive text-xs">{errors.amount.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">M-Pesa Phone Number</label>
              <input
                {...register("phone")}
                type="tel"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
              />
              {errors.phone && <p className="text-destructive text-xs">{errors.phone.message}</p>}
            </div>

            {mode === "withdraw" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Remarks (optional)</label>
                <input
                  {...register("remarks")}
                  type="text"
                  placeholder="e.g. School fees"
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setMode(null); reset({ phone }); }}
                className="flex-1 border rounded-md py-2 text-sm font-medium hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {mode === "deposit" ? "Send STK Push" : "Withdraw"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
