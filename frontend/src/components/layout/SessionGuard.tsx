"use client";

import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";

/**
 * Watches for a failed token refresh and immediately signs the user out,
 * sending them to the login page. Rendered inside the dashboard layout so
 * it only runs for authenticated routes.
 */
export function SessionGuard() {
  const { data: session } = useSession();

  useEffect(() => {
    if ((session as any)?.error === "RefreshAccessTokenError") {
      signOut({ callbackUrl: "/login" });
    }
  }, [session]);

  return null;
}
