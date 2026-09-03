export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  userId: string;
  role: string;
}

export interface MemberResponse {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  fineractClientId: number;
  fineractSavingsAccountId: number;
  status: "PENDING_ONBOARDING" | "ACTIVE" | "SUSPENDED";
  onboardedAt: string;
}

export interface WalletBalance {
  fineractSavingsAccountId: number;
  accountNo: string;
  availableBalance: number;
  accountBalance: number;
}

export interface GroupResponse {
  id: string;
  name: string;
  description: string;
  monthlyContributionTarget: number;
  contributionDueDay: number;
  fineractGroupAccountId: number;
  status: string;
  groupType: "SACCO" | "CHAMA";
  memberCount: number;
  createdAt: string;
}

export type AdminGroupSummary = GroupResponse;

export interface ContributionResponse {
  id: string;
  memberName: string;
  groupName: string;
  amount: number;
  contributionMonth: string;
  mpesaReceiptNumber: string;
  paidAt: string;
}

export interface MpesaTransaction {
  id: string;
  amount: number;
  phone: string;
  type: "DEPOSIT" | "CONTRIBUTION" | "WITHDRAWAL" | "LOAN_DISBURSEMENT";
  status: "PENDING" | "SUCCESS" | "FAILED" | "TIMEOUT";
  mpesaReceiptNumber: string;
  createdAt: string;
}

export interface LoanResponse {
  id: string;
  fineractLoanId: number;
  principal: number;
  repaymentMonths: number;
  status: string;
  groupName: string;
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

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface UserSummary {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  enabled: boolean;
  createdAt: string;
}

export interface ApiError {
  title: string;
  detail: string;
  status: number;
  errors?: Record<string, string>;
}
