"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard, Wallet, Users, CreditCard, LogOut, ShieldCheck,
  Receipt, TrendingUp, FileText, BarChart3, Gift,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  hasSacco?: boolean;
  hasChama?: boolean;
}

const baseNav = [
  { href: "/dashboard", label: "Dashboard",  icon: LayoutDashboard },
  { href: "/wallet",    label: "Wallet",      icon: Wallet },
  { href: "/groups",    label: "Groups",      icon: Users },
  { href: "/loans",     label: "Loans",       icon: CreditCard },
  { href: "/statement", label: "Statement",   icon: FileText },
];

const saccoOnlyNav = [
  { href: "/shares",    label: "My Shares",   icon: TrendingUp },
  { href: "/dividends", label: "Dividends",   icon: Gift },
];

const adminNav = [
  { href: "/dashboard",            label: "Dashboard",      icon: LayoutDashboard },
  { href: "/admin/users",          label: "Members",        icon: Users },
  { href: "/admin/groups",         label: "Groups",         icon: Users },
  { href: "/admin/loans",          label: "Loans",          icon: CreditCard },
  { href: "/admin/shares",         label: "Share Register", icon: TrendingUp },
  { href: "/admin/transactions",   label: "Transactions",   icon: Receipt },
  { href: "/admin/dividends",      label: "Dividends",      icon: Gift },
  { href: "/admin/reports",        label: "SASRA Reports",  icon: BarChart3 },
];

export function Sidebar({ hasSacco, hasChama }: SidebarProps) {
  const path = usePathname();
  const { data: session } = useSession();
  const isAdmin = (session as any)?.role === "SYSTEM_ADMIN";
  const name = session?.user?.name ?? "—";
  const initials = name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();

  const memberNav = [
    ...baseNav,
    ...(hasSacco ? saccoOnlyNav : []),
  ];

  const nav = isAdmin ? adminNav : memberNav;

  return (
    <aside className="hidden md:flex flex-col w-60 border-r bg-card h-screen sticky top-0">
      <div className="px-6 py-5 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">B</div>
          <span className="font-semibold text-lg">Bankiko</span>
        </div>
        {isAdmin && (
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            <ShieldCheck className="w-3 h-3" /> Admin
          </span>
        )}
        {!isAdmin && (hasSacco || hasChama) && (
          <div className="mt-2 flex gap-1 flex-wrap">
            {hasSacco && (
              <span className="text-xs font-medium text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">SACCO</span>
            )}
            {hasChama && (
              <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Chama</span>
            )}
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              path === href || path.startsWith(href + "/")
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}

        {/* SACCO section divider */}
        {!isAdmin && hasSacco && (
          <div className="pt-3 pb-1">
            <p className="px-3 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">SACCO</p>
          </div>
        )}
      </nav>

      <div className="px-4 py-4 border-t space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-sm font-bold">{initials}</div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{name}</p>
            <p className="text-xs text-muted-foreground">{isAdmin ? "System Admin" : "Member"}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 w-full transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
