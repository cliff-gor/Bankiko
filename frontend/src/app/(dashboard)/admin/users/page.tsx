import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminUsers } from "@/lib/api";
import { UserSummary } from "@/types";
import { UserActions } from "@/components/admin/UserActions";
import { AddToGroupDialog } from "@/components/admin/AddToGroupDialog";
import { Users } from "lucide-react";

function roleColor(role: string) {
  return role === "SYSTEM_ADMIN"
    ? "bg-purple-100 text-purple-700"
    : "bg-blue-100 text-blue-700";
}

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken;

  let users: UserSummary[] = [];
  let total = 0;
  try {
    const data = await getAdminUsers(token);
    users = data.content;
    total = data.totalElements;
  } catch {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Members</h1>
        <p className="text-muted-foreground text-sm mt-1">{total} registered users</p>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Phone</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Joined</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No users yet
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                        {u.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{u.fullName}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{u.phone}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColor(u.role)}`}>
                      {u.role === "SYSTEM_ADMIN" ? "Admin" : "Member"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.enabled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {u.enabled ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                    {new Date(u.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      <UserActions userId={u.id} enabled={u.enabled} role={u.role} />
                      <AddToGroupDialog userId={u.id} userName={u.fullName} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
