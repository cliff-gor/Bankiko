"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { joinViaInvite, InviteDetails } from "@/lib/api";
import { Users, Building2, Clock, CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
  invite: InviteDetails | null;
  error: string | null;
  inviteToken: string;
  isLoggedIn: boolean;
  accessToken?: string;
}

export function JoinGroupClient({ invite, error, inviteToken, isLoggedIn, accessToken }: Props) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  async function handleJoin() {
    if (!accessToken) return;
    setJoining(true);
    setJoinError(null);
    try {
      const result = await joinViaInvite(accessToken, inviteToken);
      setJoined(true);
      setTimeout(() => router.push("/groups"), 1500);
    } catch (e: any) {
      setJoinError(e?.message ?? "Failed to join group");
    } finally {
      setJoining(false);
    }
  }

  const isSacco = invite?.groupType === "SACCO";
  const expiresAt = invite ? new Date(invite.expiresAt) : null;
  const expiresInHours = expiresAt
    ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 3_600_000))
    : 0;

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="flex justify-center mb-8">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold">B</div>
          <span className="font-semibold text-xl">Bankiko</span>
        </div>
      </div>

      <div className="bg-card border rounded-2xl p-8 shadow-sm space-y-6">
        {error ? (
          <div className="text-center space-y-3">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold">Invite not found</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Link href="/" className="text-sm text-primary underline">Go to Bankiko</Link>
          </div>
        ) : joined ? (
          <div className="text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
            <h2 className="text-lg font-semibold">You're in!</h2>
            <p className="text-sm text-muted-foreground">Redirecting to your groups…</p>
          </div>
        ) : (
          <>
            {/* Group type badge */}
            <div className="flex justify-center">
              <span className={`text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full ${
                isSacco
                  ? "bg-purple-100 text-purple-700"
                  : "bg-amber-100 text-amber-700"
              }`}>
                {isSacco ? "SACCO" : "Chama"}
              </span>
            </div>

            {/* Group name */}
            <div className="text-center space-y-1">
              <div className="flex justify-center mb-3">
                {isSacco
                  ? <Building2 className="w-10 h-10 text-purple-500" />
                  : <Users className="w-10 h-10 text-amber-500" />}
              </div>
              <h1 className="text-2xl font-bold">{invite!.groupName}</h1>
              <p className="text-sm text-muted-foreground">
                You've been invited to join this {isSacco ? "savings and credit cooperative" : "investment group"}.
              </p>
            </div>

            {/* Expiry */}
            {expiresInHours > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
                <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  Invite expires in{" "}
                  {expiresInHours >= 24
                    ? `${Math.floor(expiresInHours / 24)} day${Math.floor(expiresInHours / 24) !== 1 ? "s" : ""}`
                    : `${expiresInHours} hour${expiresInHours !== 1 ? "s" : ""}`}
                </span>
              </div>
            )}

            {/* What SACCO members get */}
            {isSacco && (
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {["Buy shares and earn dividends", "Access loans against your share capital", "Monthly contributions tracked automatically"].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            )}

            {joinError && (
              <p className="text-sm text-destructive text-center">{joinError}</p>
            )}

            {/* Actions */}
            {isLoggedIn ? (
              <button
                onClick={handleJoin}
                disabled={joining}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {joining ? "Joining…" : `Join ${invite!.groupName}`}
              </button>
            ) : (
              <div className="space-y-3">
                <Link
                  href={`/register?redirect=/join/${inviteToken}`}
                  className="block w-full bg-primary text-primary-foreground py-3 rounded-xl font-medium hover:bg-primary/90 transition-colors text-center"
                >
                  Create account & join
                </Link>
                <Link
                  href={`/login?redirect=/join/${inviteToken}`}
                  className="block w-full border py-3 rounded-xl font-medium text-center hover:bg-accent transition-colors text-sm"
                >
                  Already have an account? Sign in
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
