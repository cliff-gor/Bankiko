import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInviteDetails } from "@/lib/api";
import { JoinGroupClient } from "./JoinGroupClient";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function JoinPage({ params }: Props) {
  const { token } = await params;
  const session = await getServerSession(authOptions);
  const accessToken = (session as any)?.accessToken as string | undefined;

  // Fetch invite details — public endpoint, no auth needed
  let invite = null;
  let error: string | null = null;
  try {
    invite = await getInviteDetails(token);
  } catch (e: any) {
    error = e?.message ?? "Invalid or expired invite link";
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <JoinGroupClient
        invite={invite}
        error={error}
        inviteToken={token}
        isLoggedIn={!!session}
        accessToken={accessToken}
      />
    </div>
  );
}
