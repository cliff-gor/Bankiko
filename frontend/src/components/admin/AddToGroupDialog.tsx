"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, X, Users } from "lucide-react";
import { getAdminGroups, adminAddMemberToGroup } from "@/lib/api";

interface Group { id: string; name: string; memberCount: number }

export function AddToGroupDialog({ userId, userName }: { userId: string; userName: string }) {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!open || groups.length > 0) return;
    setFetching(true);
    getAdminGroups(token).then(setGroups).catch(() => {}).finally(() => setFetching(false));
  }, [open, token, groups.length]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGroupId) return toast.error("Select a group");
    setLoading(true);
    try {
      await adminAddMemberToGroup(token, selectedGroupId, userId);
      const groupName = groups.find((g) => g.id === selectedGroupId)?.name ?? "group";
      toast.success(`${userName} added to ${groupName}`);
      setOpen(false);
      setSelectedGroupId("");
      router.refresh();
    } catch (err: any) {
      toast.error(err?.detail ?? "Failed to add member to group");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-2 py-1 rounded-md font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 transition-colors"
      >
        Add to group
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-lg">Add to group</h2>
                <p className="text-xs text-muted-foreground">{userName}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              {fetching ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : groups.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No groups created yet</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Select group</label>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                  >
                    <option value="">Choose a group…</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.memberCount} members)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {groups.length > 0 && (
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
                    disabled={loading || !selectedGroupId}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Add to group
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
