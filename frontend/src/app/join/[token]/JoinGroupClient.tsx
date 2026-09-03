"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { joinViaInvite, InviteDetails } from "@/lib/api";
import {
  Users, Building2, Clock, CheckCircle2, AlertCircle,
  Smartphone, Download,
} from "lucide-react";

// Store URLs — update once published
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=ke.cliffgor.bankiko";
const APP_STORE_URL  = "https://apps.apple.com/app/bankiko/id000000000"; // update after submission

type OS = "android" | "ios" | "other";

function detectOS(): OS {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "other";
}

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
  const [os, setOs] = useState<OS>("other");
  const [appOpenAttempted, setAppOpenAttempted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setOs(detectOS());
  }, []);

  // Clean up timer on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function tryOpenApp() {
    // Try the custom scheme first — if app is installed it opens immediately.
    // After 1.2s (app didn't intercept) fall through to store.
    const deepLink = `bankiko://join/${inviteToken}`;
    setAppOpenAttempted(true);

    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = deepLink;
    document.body.appendChild(iframe);

    timerRef.current = setTimeout(() => {
      document.body.removeChild(iframe);
      // App not installed — redirect to store
      const storeUrl = os === "ios" ? APP_STORE_URL : PLAY_STORE_URL;
      window.location.href = storeUrl;
    }, 1200);

    // If the page loses visibility the app opened — cancel the store redirect
    const onVisibilityChange = () => {
      if (document.hidden && timerRef.current) {
        clearTimeout(timerRef.current);
        document.body.removeChild(iframe);
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  async function handleWebJoin() {
    if (!accessToken) return;
    setJoining(true);
    setJoinError(null);
    try {
      await joinViaInvite(accessToken, inviteToken);
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
  const isMobile = os === "android" || os === "ios";
  const storeUrl = os === "ios" ? APP_STORE_URL : PLAY_STORE_URL;
  const storeLabel = os === "ios" ? "App Store" : "Google Play";

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
                isSacco ? "bg-purple-100 text-purple-700" : "bg-amber-100 text-amber-700"
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

            {/* ── Mobile: try to open app first ─────────────── */}
            {isMobile && (
              <div className="space-y-3">
                <button
                  onClick={tryOpenApp}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl font-medium hover:bg-primary/90 transition-colors"
                >
                  <Smartphone className="w-4 h-4" />
                  Open in Bankiko app
                </button>

                {appOpenAttempted && (
                  <p className="text-xs text-center text-muted-foreground">
                    Redirecting to {storeLabel} if the app isn't installed…
                  </p>
                )}

                <a
                  href={storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 border rounded-xl py-2.5 text-sm font-medium hover:bg-accent transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download from {storeLabel}
                </a>

                {/* Divider */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex-1 border-t" />
                  <span>or join on web</span>
                  <div className="flex-1 border-t" />
                </div>
              </div>
            )}

            {/* ── Web join actions ───────────────────────────── */}
            {isLoggedIn ? (
              <button
                onClick={handleWebJoin}
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

      {/* Footer note for mobile */}
      {isMobile && !error && (
        <p className="text-center text-xs text-muted-foreground mt-4">
          Best experience in the Bankiko {os === "ios" ? "iOS" : "Android"} app
        </p>
      )}
    </div>
  );
}
