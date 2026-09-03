import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminLoans } from "@/lib/api";
import { AdminLoansClient } from "./AdminLoansClient";

export default async function AdminLoansPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken;

  let loans: Awaited<ReturnType<typeof getAdminLoans>> = [];
  try {
    loans = await getAdminLoans(token);
  } catch {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">All Loans</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {loans.length} loan{loans.length !== 1 ? "s" : ""} across all members
        </p>
      </div>
      <AdminLoansClient loans={loans} token={token} />
    </div>
  );
}
