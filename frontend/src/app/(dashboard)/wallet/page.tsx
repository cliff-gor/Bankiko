import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getWalletBalance, getMe, onboardMe } from "@/lib/api";
import { formatKES } from "@/lib/utils";
import { WalletActions } from "@/components/wallet/WalletActions";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";

export default async function WalletPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken;

  let member = null;
  let balance = null;

  try { member = await getMe(token); } catch {}

  // Onboard if no member record yet, or if still pending
  if (!member || member.status === "PENDING_ONBOARDING") {
    try { member = await onboardMe(token); } catch {}
  }

  if (member?.status === "ACTIVE") {
    try { balance = await getWalletBalance(token); } catch {}
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Wallet</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your savings</p>
      </div>

      <div className="bg-primary rounded-2xl p-6 text-primary-foreground space-y-4">
        <div className="flex items-center gap-2 opacity-80">
          <Wallet className="w-4 h-4" />
          <span className="text-sm">Available Balance</span>
        </div>
        <p className="text-4xl font-bold">
          {balance ? formatKES(balance.availableBalance) : "—"}
        </p>
        {balance?.accountNo && (
          <p className="text-sm opacity-70">Account: {balance.accountNo}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-xl p-4 text-center space-y-1">
          <ArrowDownLeft className="w-5 h-5 text-emerald-500 mx-auto" />
          <p className="text-sm font-medium">Total Balance</p>
          <p className="text-lg font-bold">{balance ? formatKES(balance.accountBalance) : "—"}</p>
        </div>
        <div className="border rounded-xl p-4 text-center space-y-1">
          <ArrowUpRight className="w-5 h-5 text-blue-500 mx-auto" />
          <p className="text-sm font-medium">Available</p>
          <p className="text-lg font-bold">{balance ? formatKES(balance.availableBalance) : "—"}</p>
        </div>
      </div>

      {member?.status === "ACTIVE" ? (
        <WalletActions phone={member.phone} />
      ) : (
        <div className="border rounded-xl p-6 text-center text-muted-foreground text-sm">
          Your wallet is being set up. Refresh in a moment.
        </div>
      )}
    </div>
  );
}
