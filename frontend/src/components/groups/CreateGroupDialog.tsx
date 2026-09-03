"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Loader2, X } from "lucide-react";
import { createGroup } from "@/lib/api";

const schema = z.object({
  name: z.string().min(2, "Group name is required"),
  description: z.string().optional(),
  monthlyContributionTarget: z.coerce.number().min(0, "Enter a valid amount"),
  contributionDueDay: z.coerce.number().min(1).max(28),
  groupType: z.enum(["CHAMA", "SACCO"]),
});

type FormData = z.infer<typeof schema>;

export function CreateGroupDialog() {
  const { data: session } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { contributionDueDay: 5, groupType: "CHAMA" },
  });

  async function onSubmit(data: FormData) {
    const token = (session as any)?.accessToken;
    setLoading(true);
    try {
      await createGroup(token, data);
      toast.success(`Group "${data.name}" created`);
      reset();
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err?.detail ?? "Failed to create group");
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
        New group
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Create a group</h2>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              {/* Group type picker */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Group type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["CHAMA", "SACCO"] as const).map((type) => (
                    <label key={type} className="cursor-pointer">
                      <input type="radio" value={type} {...register("groupType")} className="sr-only" />
                      <div className={`border-2 rounded-lg p-3 text-center transition-colors ${
                        // watch via register — use a controlled approach via Controller in real app, but this works for display
                        "has-[:checked]:border-primary has-[:checked]:bg-primary/5 border-border"
                      }`}>
                        <p className="font-semibold text-sm">{type === "CHAMA" ? "Chama" : "SACCO"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {type === "CHAMA" ? "Informal group · Active immediately" : "Registered SACCO · Requires approval"}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Group name</label>
                <input
                  {...register("name")}
                  placeholder="e.g. Ndugu wa Ujenzi"
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                />
                {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Description (optional)</label>
                <textarea
                  {...register("description")}
                  rows={2}
                  placeholder="What is this group for?"
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Monthly target (KES)</label>
                  <input
                    {...register("monthlyContributionTarget")}
                    type="number"
                    placeholder="2000"
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                  />
                  {errors.monthlyContributionTarget && (
                    <p className="text-destructive text-xs">{errors.monthlyContributionTarget.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Due day (1-28)</label>
                  <input
                    {...register("contributionDueDay")}
                    type="number"
                    min={1}
                    max={28}
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                  />
                </div>
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
                  Create group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
