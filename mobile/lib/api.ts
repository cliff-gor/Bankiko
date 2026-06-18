import Constants from "expo-constants";
import { storage } from "./storage";

const BASE_URL = Constants.expoConfig?.extra?.apiUrl ?? "http://localhost:8080";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await storage.getAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw err;
  }
  return res.json();
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  email: string;
  fullName: string;
  role: string;
}

export interface MemberResponse {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  status: string;
  fineractClientId: number | null;
  savingsAccountId: number | null;
}

export interface WalletBalance {
  accountId: number;
  balance: number;
  currency: string;
}

export interface GroupResponse {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  role: string;
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
  groupName: string;
  principal: number;
  status: string;
  repaymentMonths: number;
  disbursedAt: string | null;
  createdAt: string;
}

export interface MpesaTransaction {
  id: string;
  type: string;
  amount: number;
  phoneNumber: string;
  status: string;
  createdAt: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (data: { fullName: string; email: string; phoneNumber: string; password: string }) =>
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
  deposit: (amount: number, phoneNumber: string) =>
    request("/api/wallet/deposit", {
      method: "POST",
      body: JSON.stringify({ amount, phoneNumber }),
    }),
  withdraw: (amount: number, phoneNumber: string) =>
    request("/api/wallet/withdraw", {
      method: "POST",
      body: JSON.stringify({ amount, phoneNumber }),
    }),
};

export const groupApi = {
  list: () => request<GroupResponse[]>("/api/groups"),
  create: (name: string, description: string) =>
    request<GroupResponse>("/api/groups", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    }),
};

export const contributionApi = {
  contribute: (groupId: string, amount: number, phoneNumber: string, contributionMonth: string) =>
    request("/api/contributions", {
      method: "POST",
      body: JSON.stringify({ groupId, amount, phoneNumber, contributionMonth }),
    }),
  list: () => request<ContributionResponse[]>("/api/contributions"),
};

export const loanApi = {
  list: () => request<LoanResponse[]>("/api/loans"),
  apply: (groupId: string, principal: number, repaymentMonths: number, purpose?: string) =>
    request<LoanResponse>("/api/loans/apply", {
      method: "POST",
      body: JSON.stringify({ groupId, principal, repaymentMonths, purpose }),
    }),
};
