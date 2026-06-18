"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Loader2, X } from "lucide-react";
import { applyForLoan } from "@/lib/api";
import { GroupResponse } from "@/types";

const schema = z.object({
  groupId: z.string().min(1, "Select a group"),
  principal: z.coerce.number().min(1000, "Minimum loan is KES 1,000"),
  repaymentMonths: z.coerce.number().min(1).max(24),
  purpose: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function ApplyLoanDialog({ groups }: { groups: GroupResponse[] }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { repaymentMonths: 3 },
  });

  async function onSubmit(data: FormData) {
    const token = (session as any)?.accessToken;
    setLoading(true);
    try {
      await applyForLoan(token, data);
      toast.success("Loan application submitted — awaiting group admin approval");
      reset();
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err?.detail ?? "Loan application failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
      >
        <Plus className="w-4 h-4" />
        Apply for loan
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Apply for a loan</h2>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Group</label>
                <select
                  {...register("groupId")}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                >
                  <option value="">Select a group</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
                {errors.groupId && <p className="text-destructive text-xs">{errors.groupId.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Amount (KES)</label>
                  <input
                    {...register("principal")}
                    type="number"
                    placeholder="10000"
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                  />
                  {errors.principal && <p className="text-destructive text-xs">{errors.principal.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Repay in (months)</label>
                  <input
                    {...register("repaymentMonths")}
                    type="number"
                    min={1}
                    max={24}
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Purpose (optional)</label>
                <input
                  {...register("purpose")}
                  placeholder="e.g. School fees, business"
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setOpen(false); reset(); }}
                  className="flex-1 border rounded-md py-2 text-sm font-medium hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
