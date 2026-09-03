import { AuthResponse, WalletBalance, GroupResponse, ContributionResponse, MpesaTransaction, LoanResponse, LoanRepayment, StatementEntry, ShareHoldingResponse, MemberResponse, UserSummary, Page } from "@/types";
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
  groupType: "CHAMA" | "SACCO";
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

export async function getLoans(token: string) {
  return request<LoanResponse[]>("/api/loans", {}, token);
}

export async function getPendingLoans(token: string) {
  return request<LoanResponse[]>("/api/loans/pending", {}, token);
}

export async function approveLoan(token: string, loanId: string) {
  return request<LoanResponse>(`/api/loans/${loanId}/approve`, { method: "POST" }, token);
}

export async function rejectLoan(token: string, loanId: string) {
  return request<LoanResponse>(`/api/loans/${loanId}/reject`, { method: "POST" }, token);
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export async function getAdminUsers(token: string, page = 0) {
  return request<Page<UserSummary>>(`/api/admin/users?page=${page}&size=20`, {}, token);
}

export async function setUserEnabled(token: string, userId: string, enabled: boolean) {
  return request<void>(`/api/admin/users/${userId}/${enabled ? "enable" : "disable"}`, { method: "PUT" }, token);
}

export async function setUserRole(token: string, userId: string, role: string) {
  return request<void>(`/api/admin/users/${userId}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  }, token);
}

export type AdminGroupSummary = { id: string; name: string; description: string; monthlyContributionTarget: number; groupType: string; status: string; memberCount: number };

export async function getAdminGroups(token: string) {
  return request<AdminGroupSummary[]>("/api/admin/groups", {}, token);
}

export async function getAdminPendingGroups(token: string) {
  return request<AdminGroupSummary[]>("/api/admin/groups/pending", {}, token);
}

export async function adminApproveGroup(token: string, groupId: string) {
  return request<void>(`/api/admin/groups/${groupId}/approve`, { method: "POST" }, token);
}

export async function adminRejectGroup(token: string, groupId: string, reason?: string) {
  return request<void>(`/api/admin/groups/${groupId}/reject?${reason ? `reason=${encodeURIComponent(reason)}` : ""}`, { method: "POST" }, token);
}

export async function adminAddMemberToGroup(token: string, groupId: string, userId: string) {
  return request<void>(`/api/admin/groups/${groupId}/members/${userId}`, { method: "POST" }, token);
}

export async function getAdminTransactions(token: string, page = 0) {
  return request<{ content: { id: string; userId: string; type: string; amount: number; status: string; mpesaReceiptNumber: string | null; phone: string; createdAt: string }[]; totalElements: number }>(`/api/admin/transactions?page=${page}&size=30`, {}, token);
}

export async function getLoanSchedule(token: string, loanId: string) {
  return request<LoanRepayment[]>(`/api/loans/${loanId}/schedule`, {}, token);
}

export async function getStatement(token: string) {
  return request<StatementEntry[]>("/api/wallet/statement", {}, token);
}

export async function getShareHolding(token: string, groupId: string) {
  return request<ShareHoldingResponse>(`/api/shares/groups/${groupId}/my-holding`, {}, token);
}

export async function getShareRegister(token: string, groupId: string) {
  return request<ShareHoldingResponse[]>(`/api/shares/groups/${groupId}/register`, {}, token);
}

export async function getAdminLoans(token: string) {
  return request<{ id: string; userId: string; memberName: string; groupName: string; principal: number; repaymentMonths: number; status: string; purpose: string | null; appliedAt: string; disbursedAt: string | null }[]>("/api/admin/loans", {}, token);
}

// ── Invites ────────────────────────────────────────────────────────────────

export interface InviteDetails {
  inviteId: string;
  token: string;
  groupId: string;
  groupName: string;
  groupType: "SACCO" | "CHAMA";
  expiresAt: string;
  maxUses: number | null;
  useCount: number;
  inviteUrl: string;
}

export async function createGroupInvite(
  token: string,
  groupId: string,
  ttlHours = 168,
  maxUses?: number
): Promise<InviteDetails> {
  const params = new URLSearchParams({ ttlHours: String(ttlHours) });
  if (maxUses != null) params.set("maxUses", String(maxUses));
  return request<InviteDetails>(`/api/groups/${groupId}/invites?${params}`, { method: "POST" }, token);
}

export async function getInviteDetails(inviteToken: string): Promise<InviteDetails> {
  return request<InviteDetails>(`/api/invites/${inviteToken}`);
}

export async function joinViaInvite(
  token: string,
  inviteToken: string
): Promise<{ message: string; groupId: string; groupType: string }> {
  return request(`/api/invites/${inviteToken}/join`, { method: "POST" }, token);
}
