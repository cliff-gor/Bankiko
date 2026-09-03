"use client";

import { useState } from "react";
import { createGroupInvite, InviteDetails } from "@/lib/api";
import { Share2, Copy, MessageSquare, Check, Loader2, Link2, X } from "lucide-react";

interface Props {
  groupId: string;
  groupName: string;
  token: string; // session access token
}

export function InviteShareSheet({ groupId, groupName, token }: Props) {
  const [open, setOpen] = useState(false);
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ttlHours, setTtlHours] = useState(168); // 7 days

  async function generateInvite() {
    setLoading(true);
    setError(null);
    try {
      const result = await createGroupInvite(token, groupId, ttlHours);
      setInvite(result);
    } catch (e: any) {
      setError(e?.message ?? "Failed to create invite");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!invite) return;
    await navigator.clipboard.writeText(invite.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareNative() {
    if (!invite || !navigator.share) return;
    navigator.share({
      title: `Join ${groupName} on Bankiko`,
      text: `You're invited to join ${groupName}. Click the link to join:`,
      url: invite.inviteUrl,
    }).catch(() => {});
  }

  function shareViaSms() {
    if (!invite) return;
    const text = encodeURIComponent(
      `Join ${groupName} on Bankiko: ${invite.inviteUrl}`
    );
    window.open(`sms:?body=${text}`, "_blank");
  }

  function shareViaWhatsApp() {
    if (!invite) return;
    const text = encodeURIComponent(
      `You're invited to join *${groupName}* on Bankiko 🏦\n\n${invite.inviteUrl}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  const expiresAt = invite ? new Date(invite.expiresAt) : null;
  const expiresLabel = expiresAt
    ? expiresAt.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <>
      <button
        onClick={() => { setOpen(true); if (!invite) generateInvite(); }}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-accent transition-colors"
      >
        <Share2 className="w-4 h-4" />
        Invite members
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <h2 className="font-semibold">Invite to {groupName}</h2>
                {expiresLabel && (
                  <p className="text-xs text-muted-foreground">Expires {expiresLabel}</p>
                )}
              </div>
              <button onClick={() => setOpen(false)} className="p-1 rounded-md hover:bg-accent">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : error ? (
                <p className="text-sm text-destructive text-center">{error}</p>
              ) : invite ? (
                <>
                  {/* Link display */}
                  <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2.5">
                    <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs font-mono text-muted-foreground truncate flex-1">
                      {invite.inviteUrl}
                    </span>
                    <button
                      onClick={copyLink}
                      className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>

                  {/* Share channels */}
                  <div className="grid grid-cols-3 gap-3">
                    {typeof navigator !== "undefined" && "share" in navigator && (
                      <button
                        onClick={shareNative}
                        className="flex flex-col items-center gap-2 p-3 border rounded-xl hover:bg-accent transition-colors"
                      >
                        <Share2 className="w-5 h-5" />
                        <span className="text-xs font-medium">Share</span>
                      </button>
                    )}
                    <button
                      onClick={shareViaSms}
                      className="flex flex-col items-center gap-2 p-3 border rounded-xl hover:bg-accent transition-colors"
                    >
                      <MessageSquare className="w-5 h-5" />
                      <span className="text-xs font-medium">SMS</span>
                    </button>
                    <button
                      onClick={shareViaWhatsApp}
                      className="flex flex-col items-center gap-2 p-3 border rounded-xl hover:bg-accent transition-colors"
                    >
                      {/* WhatsApp icon via SVG */}
                      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#25D366]">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                      </svg>
                      <span className="text-xs font-medium">WhatsApp</span>
                    </button>
                  </div>

                  {/* TTL selector */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">New link expiry</span>
                    <select
                      value={ttlHours}
                      onChange={(e) => setTtlHours(Number(e.target.value))}
                      className="text-sm border rounded-md px-2 py-1 bg-background"
                    >
                      <option value={24}>1 day</option>
                      <option value={72}>3 days</option>
                      <option value={168}>7 days</option>
                      <option value={720}>30 days</option>
                    </select>
                    <button
                      onClick={generateInvite}
                      className="text-primary text-sm font-medium hover:underline"
                    >
                      Generate new
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
