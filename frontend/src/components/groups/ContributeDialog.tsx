"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, X, Wallet } from "lucide-react";
import { contributeToGroup } from "@/lib/api";

export function ContributeDialog({ groupId, groupName }: { groupId: string; groupName: string }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = (session as any)?.accessToken;
    const amt = Number(amount);
    if (!amt || amt < 1) return toast.error("Enter a valid amount");
    if (!phone) return toast.error("Enter your M-Pesa phone number");

    setLoading(true);
    try {
      await contributeToGroup(token, groupId, amt, phone);
      toast.success("STK Push sent — check your phone to complete payment");
      setOpen(false);
      setAmount("");
      setPhone("");
      router.refresh();
    } catch (err: any) {
      toast.error(err?.detail ?? "Failed to initiate contribution");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 flex-shrink-0"
      >
        <Wallet className="w-4 h-4" />
        Contribute
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-lg">Contribute</h2>
                <p className="text-xs text-muted-foreground">{groupName}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Amount (KES)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 2000"
                  min={1}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">M-Pesa phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07XXXXXXXX"
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
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
                  Pay via M-Pesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
