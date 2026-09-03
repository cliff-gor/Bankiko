import Constants from "expo-constants";
import { storage } from "./storage";
import { router } from "expo-router";

const BASE_URL = Constants.expoConfig?.extra?.apiUrl ?? "http://localhost:8080";

let isRefreshing = false;
let refreshQueue: Array<() => void> = [];

async function handleTokenRefresh(): Promise<string | null> {
  if (isRefreshing) {
    return new Promise((resolve) => {
      refreshQueue.push(async () => resolve(await storage.getAccessToken()));
    });
  }

  isRefreshing = true;
  try {
    const refreshToken = await storage.getRefreshToken();
    if (!refreshToken) throw new Error("No refresh token");

    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) throw new Error("Refresh failed");

    const data: AuthResponse = await res.json();
    await storage.saveTokens(data.accessToken, data.refreshToken);
    await storage.saveUser({ email: data.email, fullName: data.fullName, role: data.role, phone: (data as any).phone });

    refreshQueue.forEach((cb) => cb());
    refreshQueue = [];
    return data.accessToken;
  } catch {
    await storage.clear();
    router.replace("/(auth)/login");
    return null;
  } finally {
    isRefreshing = false;
  }
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const token = await storage.getAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401 && retry) {
    const newToken = await handleTokenRefresh();
    if (newToken) return request<T>(path, options, false);
    throw { status: 401, detail: "Session expired" };
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  email: string;
  fullName: string;
  phone?: string;
  role: string;
}

export interface MemberResponse {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  status: string;
  fineractClientId: number | null;
  fineractSavingsAccountId: number | null;
  onboardedAt: string | null;
}

export interface WalletBalance {
  fineractSavingsAccountId: number | null;
  accountNo: string | null;
  availableBalance: number;
  accountBalance: number;
}

export interface GroupResponse {
  id: string;
  name: string;
  description: string;
  monthlyContributionTarget: number;
  contributionDueDay: number;
  memberCount: number;
  role: string;
  status: string;
  groupType: "CHAMA" | "SACCO";
}

export interface ContributionResponse {
  id: string;
  groupName: string;
  amount: number;
  contributionMonth: string;
  status: string;
  createdAt: string;
}

export interface LoanResponse {
  id: string;
  fineractLoanId: number | null;
  groupName: string;
  principal: number;
  repaymentMonths: number;
  status: string;
  purpose: string | null;
  appliedAt: string;
  disbursedAt: string | null;
}

export interface LoanRepayment {
  id: string;
  installmentNo: number;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  status: "PENDING" | "PAID" | "OVERDUE";
  paidAt: string | null;
}

export interface StatementEntry {
  id: string;
  type: string;
  description: string;
  amount: number;
  status: string;
  reference: string | null;
  createdAt: string;
}

export interface ShareHoldingResponse {
  groupId: string;
  groupName: string;
  sharesHeld: number;
  totalInvested: number;
  sharePrice: number;
  loanMultiplier: number;
  maxLoanEligible: number;
  minShares: number;
  maxShares: number;
  memberName: string | null;
}

export interface MpesaTransactionResponse {
  id: string;
  type: "DEPOSIT" | "CONTRIBUTION" | "WITHDRAWAL" | "LOAN_DISBURSEMENT" | "SHARE_PURCHASE";
  amount: number;
  phone: string;
  status: "PENDING" | "SUCCESS" | "FAILED" | "TIMEOUT";
  mpesaReceiptNumber: string | null;
  createdAt: string;
  completedAt: string | null;
}

export const authApi = {
  login: (email: string, password: string) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (data: { fullName: string; email: string; phone: string; password: string }) =>
    request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  refresh: (refreshToken: string) =>
    request<AuthResponse>("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),
};

export const memberApi = {
  me: () => request<MemberResponse>("/api/members/me"),
  onboard: () => request<MemberResponse>("/api/members/onboard", { method: "POST" }),
};

export const walletApi = {
  balance: () => request<WalletBalance>("/api/wallet/balance"),
  transactions: (page = 0) =>
    request<{ content: MpesaTransactionResponse[]; totalElements: number }>(`/api/wallet/transactions?page=${page}&size=30`),
  deposit: (amount: number, phone: string) =>
    request("/api/wallet/deposit", {
      method: "POST",
      body: JSON.stringify({ amount, phone }),
    }),
  withdraw: (amount: number, phone: string) =>
    request("/api/wallet/withdraw", {
      method: "POST",
      body: JSON.stringify({ amount, phone }),
    }),
};

export const groupApi = {
  list: () =>
    request<{ content: GroupResponse[] }>("/api/groups?page=0&size=50").then((p) => p.content),
  get: (id: string) => request<GroupResponse>(`/api/groups/${id}`),
  create: (name: string, description: string, monthlyContributionTarget: number, contributionDueDay: number, groupType: "CHAMA" | "SACCO" = "CHAMA") =>
    request<GroupResponse>("/api/groups", {
      method: "POST",
      body: JSON.stringify({ name, description, monthlyContributionTarget, contributionDueDay, groupType }),
    }),
  contribute: (groupId: string, amount: number, phone: string) =>
    request("/api/wallet/deposit", {
      method: "POST",
      body: JSON.stringify({ amount, phone, groupId }),
    }),
  addMember: (groupId: string, targetUserId: string) =>
    request<void>(`/api/groups/${groupId}/members/${targetUserId}`, { method: "POST" }),
  lookupUser: (q: string) =>
    request<{ id: string; fullName: string; phone: string; email: string }>(`/api/groups/users/lookup?q=${encodeURIComponent(q)}`),
};

export const shareApi = {
  myHolding: (groupId: string) =>
    request<ShareHoldingResponse>(`/api/shares/groups/${groupId}/my-holding`),
  buyShares: (groupId: string, numberOfShares: number, phone: string) =>
    request("/api/shares/buy", {
      method: "POST",
      body: JSON.stringify({ groupId, numberOfShares, phone }),
    }),
  register: (groupId: string) =>
    request<ShareHoldingResponse[]>(`/api/shares/groups/${groupId}/register`),
};

export const contributionApi = {
  contribute: (groupId: string, amount: number, phone: string, contributionMonth: string) =>
    request("/api/contributions", {
      method: "POST",
      body: JSON.stringify({ groupId, amount, phone, contributionMonth }),
    }),
  list: () => request<ContributionResponse[]>("/api/contributions"),
};

export const loanApi = {
  list: () => request<LoanResponse[]>("/api/loans"),
  apply: (groupId: string, principal: number, repaymentMonths: number, purpose?: string) =>
    request<LoanResponse>("/api/loans", {
      method: "POST",
      body: JSON.stringify({ groupId, principal, repaymentMonths, purpose }),
    }),
  repay: (loanId: string, amount: number) =>
    request<void>(`/api/loans/${loanId}/repay?amount=${amount}`, { method: "POST" }),
  schedule: (loanId: string) =>
    request<LoanRepayment[]>(`/api/loans/${loanId}/schedule`),
};

export const statementApi = {
  list: () => request<StatementEntry[]>("/api/wallet/statement"),
};

export interface InviteDetails {
  groupId: string;
  groupName: string;
  groupType: "SACCO" | "CHAMA";
  expiresAt: string;
  inviteUrl: string;
}

// Public endpoint — no auth needed
export async function getInviteDetails(token: string): Promise<InviteDetails> {
  const res = await fetch(`${BASE_URL}/api/invites/${token}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Invalid invite");
  return res.json();
}

export async function joinViaInvite(
  accessToken: string,
  inviteToken: string
): Promise<{ message: string; groupId: string; groupType: string }> {
  const res = await fetch(`${BASE_URL}/api/invites/${inviteToken}/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Failed to join");
  return res.json();
}

export const deviceTokenApi = {
  register: (token: string, platform = "FCM") =>
    request<void>("/api/device-tokens", {
      method: "POST",
      body: JSON.stringify({ token, platform }),
    }),
  unregister: (token: string) =>
    request<void>("/api/device-tokens", {
      method: "DELETE",
      body: JSON.stringify({ token }),
    }),
};
