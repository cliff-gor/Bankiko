import { AuthResponse, WalletBalance, GroupResponse, ContributionResponse, MpesaTransaction, LoanResponse, MemberResponse, Page } from "@/types";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

async function getToken(): Promise<string | null> {
  // Called from Server Components — reads session server-side
  const session = await getServerSession(authOptions);
  return (session as any)?.accessToken ?? null;
}

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };

  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw { status: res.status, ...err };
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (body: { fullName: string; email: string; phone: string; password: string }) =>
    request<AuthResponse>("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    request<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),

  refresh: (refreshToken: string) =>
    request<AuthResponse>("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),
};

// ── Member ────────────────────────────────────────────────────────────────────

export async function getMe(token: string) {
  return request<MemberResponse>("/api/members/me", {}, token);
}

export async function onboardMe(token: string) {
  return request<MemberResponse>("/api/members/onboard", { method: "POST" }, token);
}

// ── Wallet ────────────────────────────────────────────────────────────────────

export async function getWalletBalance(token: string) {
  return request<WalletBalance>("/api/wallet/balance", {}, token);
}

export async function initiateDeposit(token: string, amount: number, phone: string) {
  return request<MpesaTransaction>("/api/wallet/deposit", {
    method: "POST",
    body: JSON.stringify({ amount, phone }),
  }, token);
}

export async function initiateWithdraw(token: string, amount: number, phone: string, remarks?: string) {
  return request<MpesaTransaction>("/api/wallet/withdraw", {
    method: "POST",
    body: JSON.stringify({ amount, phone, remarks }),
  }, token);
}

// ── Groups ────────────────────────────────────────────────────────────────────

export async function getGroups(token: string, page = 0) {
  return request<Page<GroupResponse>>(`/api/groups?page=${page}&size=20`, {}, token);
}

export async function getGroup(token: string, groupId: string) {
  return request<GroupResponse>(`/api/groups/${groupId}`, {}, token);
}

export async function createGroup(token: string, body: {
  name: string;
  description?: string;
  monthlyContributionTarget: number;
  contributionDueDay: number;
}) {
  return request<GroupResponse>("/api/groups", {
    method: "POST",
    body: JSON.stringify(body),
  }, token);
}

export async function addGroupMember(token: string, groupId: string, targetUserId: string) {
  return request<void>(`/api/groups/${groupId}/members/${targetUserId}`, { method: "POST" }, token);
}

// ── Contributions ─────────────────────────────────────────────────────────────

export async function contributeToGroup(token: string, groupId: string, amount: number, phone: string) {
  return request<MpesaTransaction>(`/api/groups/${groupId}/contributions`, {
    method: "POST",
    body: JSON.stringify({ amount, phone }),
  }, token);
}

export async function getGroupContributions(token: string, groupId: string, page = 0) {
  return request<Page<ContributionResponse>>(
    `/api/groups/${groupId}/contributions?page=${page}&size=20`, {}, token
  );
}

export async function getMyContributions(token: string, groupId: string) {
  return request<Page<ContributionResponse>>(
    `/api/groups/${groupId}/contributions/mine`, {}, token
  );
}

// ── Loans ─────────────────────────────────────────────────────────────────────

export async function applyForLoan(token: string, body: {
  groupId: string;
  principal: number;
  repaymentMonths: number;
  purpose?: string;
}) {
  return request<LoanResponse>("/api/loans", {
    method: "POST",
    body: JSON.stringify(body),
  }, token);
}
