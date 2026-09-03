package ke.cliffgor.bankiko.loan.service;

import ke.cliffgor.bankiko.auth.model.User;
import ke.cliffgor.bankiko.common.exception.BankikoException;
import ke.cliffgor.bankiko.fineract.client.FineractClient;
import ke.cliffgor.bankiko.group.model.SaccoGroup;
import ke.cliffgor.bankiko.group.service.GroupService;
import ke.cliffgor.bankiko.loan.dto.LoanApplicationRequest;
import ke.cliffgor.bankiko.loan.dto.LoanResponse;
import ke.cliffgor.bankiko.loan.model.Loan;
import ke.cliffgor.bankiko.loan.repository.LoanRepository;
import ke.cliffgor.bankiko.member.model.Member;
import ke.cliffgor.bankiko.member.service.MemberService;
import ke.cliffgor.bankiko.mpesa.model.MpesaTransaction;
import ke.cliffgor.bankiko.mpesa.repository.MpesaTransactionRepository;
import ke.cliffgor.bankiko.contribution.model.Contribution;
import ke.cliffgor.bankiko.contribution.repository.ContributionRepository;
import ke.cliffgor.bankiko.loan.model.LoanRepayment;
import ke.cliffgor.bankiko.loan.repository.LoanRepaymentRepository;
import ke.cliffgor.bankiko.notification.service.PushNotificationService;
import ke.cliffgor.bankiko.notification.service.SmsService;
import ke.cliffgor.bankiko.share.repository.ShareHoldingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class LoanService {

    private final LoanRepository loanRepository;
    private final FineractClient fineractClient;
    private final MemberService memberService;
    private final GroupService groupService;
    private final SmsService smsService;
    private final MpesaTransactionRepository transactionRepository;
    private final ShareHoldingRepository shareHoldingRepository;
    private final ContributionRepository contributionRepository;
    private final LoanRepaymentRepository repaymentRepository;
    private final PushNotificationService pushService;

    @Transactional(readOnly = true)
    public List<LoanResponse> listForUser(UUID userId) {
        return loanRepository.findByUserIdOrderByAppliedAtDesc(userId)
            .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<LoanResponse> listPending() {
        return loanRepository.findByStatusOrderByAppliedAtDesc("PENDING_APPROVAL")
            .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public LoanResponse apply(User user, LoanApplicationRequest request) {
        Member member = memberService.requireActiveByUserId(user.getId());
        SaccoGroup group = groupService.requireGroup(request.getGroupId());
        groupService.requireMembership(group, user.getId());

        // SACCO groups require a minimum number of monthly contributions before borrowing
        if (group.getGroupType() == SaccoGroup.GroupType.SACCO) {
            long months = contributionRepository.countByMemberAndGroup(member, group);
            int required = group.getMinContributionsRequired();
            if (months < required) {
                throw new BankikoException(
                    "You need at least " + required + " months of contributions to apply for a loan in this group. You have " + months + ".",
                    HttpStatus.BAD_REQUEST);
            }
        }

        // SACCO groups enforce share-based loan eligibility
        if (group.getGroupType() == SaccoGroup.GroupType.SACCO) {
            var holding = shareHoldingRepository.findByGroupIdAndMemberId(group.getId(), member.getId());
            int sharesHeld = holding.map(ke.cliffgor.bankiko.share.model.ShareHolding::getSharesHeld).orElse(0);
            BigDecimal maxLoan = group.getSharePrice()
                .multiply(BigDecimal.valueOf(sharesHeld))
                .multiply(BigDecimal.valueOf(group.getLoanMultiplier()));
            if (request.getPrincipal().compareTo(maxLoan) > 0) {
                throw new BankikoException(
                    "Loan amount exceeds your share-based limit of KES " + maxLoan +
                    " (" + sharesHeld + " shares × KES " + group.getSharePrice() + " × " + group.getLoanMultiplier() + ")",
                    HttpStatus.BAD_REQUEST);
            }
        }

        // All groups: verify the pool has sufficient funds before accepting the application
        if (group.getFineractGroupAccountId() != null) {
            try {
                var poolBalance = fineractClient.getBalance(group.getFineractGroupAccountId());
                BigDecimal available = poolBalance.getAvailableBalance() != null
                    ? poolBalance.getAvailableBalance() : BigDecimal.ZERO;
                if (available.compareTo(request.getPrincipal()) < 0) {
                    throw new BankikoException(
                        "Insufficient group pool funds. Pool has KES " + available +
                        " but you requested KES " + request.getPrincipal() + ".",
                        HttpStatus.CONFLICT);
                }
            } catch (BankikoException e) {
                throw e;
            } catch (Exception e) {
                log.warn("Could not verify pool balance at application time: {}", e.getMessage());
            }
        }

        Loan loan = Loan.builder()
            .user(user)
            .groupId(group.getId())
            .groupName(group.getName())
            .principal(request.getPrincipal())
            .repaymentMonths(request.getRepaymentMonths())
            .purpose(request.getPurpose())
            .status("PENDING_APPROVAL")
            .build();

        try {
            if (member.getFineractClientId() != null) {
                var fineractResp = fineractClient.applyLoan(
                    member.getFineractClientId(), 1,
                    request.getPrincipal(), request.getRepaymentMonths(),
                    "loan-" + user.getId().toString().substring(0, 8)
                );
                loan.setFineractLoanId(fineractResp.getResourceId());
            }
        } catch (Exception e) {
            log.warn("Fineract loan application failed, tracking locally only: {}", e.getMessage());
        }

        loan = loanRepository.save(loan);

        try {
            smsService.send(user.getPhone(),
                "Bankiko: Loan application of KES " + request.getPrincipal() + " submitted. Awaiting approval.");
        } catch (Exception ignored) {}

        log.info("Loan applied: userId={} loanId={} principal={}", user.getId(), loan.getId(), loan.getPrincipal());
        return toResponse(loan);
    }

    @Transactional
    public LoanResponse approve(UUID loanId, User adminUser) {
        Loan loan = loanRepository.findById(loanId)
            .orElseThrow(() -> new BankikoException("Loan not found", HttpStatus.NOT_FOUND));

        if (!"PENDING_APPROVAL".equals(loan.getStatus())) {
            throw new BankikoException("Loan is not pending approval", HttpStatus.CONFLICT);
        }

        SaccoGroup group = groupService.requireGroup(loan.getGroupId());

        // Verify pool has enough funds to cover this disbursement
        if (group.getFineractGroupAccountId() != null) {
            try {
                var poolBalance = fineractClient.getBalance(group.getFineractGroupAccountId());
                BigDecimal available = poolBalance.getAvailableBalance() != null ? poolBalance.getAvailableBalance() : BigDecimal.ZERO;
                if (available.compareTo(loan.getPrincipal()) < 0) {
                    throw new BankikoException(
                        "Insufficient group pool funds. Available: KES " + available + ", Requested: KES " + loan.getPrincipal(),
                        HttpStatus.CONFLICT);
                }
            } catch (BankikoException e) {
                throw e;
            } catch (Exception e) {
                log.warn("Could not verify pool balance, proceeding with disbursal: {}", e.getMessage());
            }
        }

        // Snapshot interest config from the group at origination time
        loan.setInterestRate(group.getAnnualInterestRate());
        loan.setInterestType(group.getInterestType().name());
        loan.setStatus("ACTIVE");
        loan.setDisbursedAt(Instant.now());

        // Calculate total interest so outstanding balance is set before schedule generation
        BigDecimal totalInterest = calculateTotalInterest(
            loan.getPrincipal(), group.getAnnualInterestRate(), group.getInterestType(), loan.getRepaymentMonths());
        loan.setTotalInterest(totalInterest);
        loan.setOutstandingBalance(loan.getPrincipal().add(totalInterest));
        loan = loanRepository.save(loan);

        // Generate monthly repayment schedule
        generateRepaymentSchedule(loan, group.getInterestType());

        // Record disbursement in transaction history so it shows in member's wallet
        transactionRepository.save(MpesaTransaction.builder()
            .user(loan.getUser())
            .amount(loan.getPrincipal())
            .phone(loan.getUser().getPhone())
            .type(MpesaTransaction.TransactionType.LOAN_DISBURSEMENT)
            .status(MpesaTransaction.TransactionStatus.SUCCESS)
            .mpesaReceiptNumber("LOAN-" + loanId.toString().substring(0, 8).toUpperCase())
            .completedAt(Instant.now())
            .build());

        String loanMsg = "Bankiko: Your loan of KES " + loan.getPrincipal() + " has been approved and disbursed.";
        try { smsService.send(loan.getUser().getPhone(), loanMsg); } catch (Exception ignored) {}
        pushService.sendToUser(loan.getUser(), "Loan Approved 🎉", "KES " + loan.getPrincipal() + " disbursed from " + loan.getGroupName());

        log.info("Loan approved: loanId={} by adminId={}", loanId, adminUser.getId());
        return toResponse(loan);
    }

    @Transactional
    public LoanResponse reject(UUID loanId, User adminUser) {
        Loan loan = loanRepository.findById(loanId)
            .orElseThrow(() -> new BankikoException("Loan not found", HttpStatus.NOT_FOUND));

        loan.setStatus("REJECTED");
        loan = loanRepository.save(loan);

        try { smsService.send(loan.getUser().getPhone(), "Bankiko: Your loan application was not approved."); } catch (Exception ignored) {}
        pushService.sendToUser(loan.getUser(), "Loan Update", "Your loan application was not approved.");

        log.info("Loan rejected: loanId={} by adminId={}", loanId, adminUser.getId());
        return toResponse(loan);
    }

    @Transactional
    public void repay(User user, UUID loanId, BigDecimal amount) {
        Loan loan = loanRepository.findById(loanId)
            .orElseThrow(() -> new BankikoException("Loan not found", HttpStatus.NOT_FOUND));

        if (!loan.getUser().getId().equals(user.getId())) {
            throw new BankikoException("Not your loan", HttpStatus.FORBIDDEN);
        }

        try {
            if (loan.getFineractLoanId() != null) {
                fineractClient.repayLoan(loan.getFineractLoanId(), amount, "repay-" + System.currentTimeMillis());
            }
        } catch (Exception e) {
            log.warn("Fineract repayment failed, recording locally: {}", e.getMessage());
        }

        // Mark the next pending/overdue installment as paid, deduct from outstanding balance
        repaymentRepository.findFirstByLoanIdAndStatusOrderByInstallmentNo(loanId, LoanRepayment.RepaymentStatus.PENDING)
            .or(() -> repaymentRepository.findFirstByLoanIdAndStatusOrderByInstallmentNo(loanId, LoanRepayment.RepaymentStatus.OVERDUE))
            .ifPresent(inst -> {
                inst.setAmountPaid(amount);
                inst.setStatus(LoanRepayment.RepaymentStatus.PAID);
                inst.setPaidAt(Instant.now());
                repaymentRepository.save(inst);

                // Reduce outstanding balance
                if (loan.getOutstandingBalance() != null) {
                    BigDecimal newBalance = loan.getOutstandingBalance().subtract(inst.getAmountDue()).max(BigDecimal.ZERO);
                    loan.setOutstandingBalance(newBalance);
                }

                // If no PENDING or OVERDUE installments remain, close the loan
                long remaining = repaymentRepository.findByLoanIdOrderByInstallmentNo(loanId)
                    .stream().filter(i -> i.getStatus() == LoanRepayment.RepaymentStatus.PENDING
                        || i.getStatus() == LoanRepayment.RepaymentStatus.OVERDUE).count();
                if (remaining == 0) {
                    loan.setStatus("CLOSED");
                    loan.setOutstandingBalance(BigDecimal.ZERO);
                }
                loanRepository.save(loan);
            });

        try {
            smsService.send(user.getPhone(),
                "Bankiko: KES " + amount + " loan repayment received. Thank you.");
        } catch (Exception ignored) {}

        log.info("Loan repayment: userId={} loanId={} amount={}", user.getId(), loanId, amount);
    }

    @Transactional(readOnly = true)
    public List<LoanRepayment> listRepayments(UUID loanId) {
        return repaymentRepository.findByLoanIdOrderByInstallmentNo(loanId);
    }

    @Transactional
    public LoanResponse markPaid(UUID loanId, User adminUser) {
        Loan loan = loanRepository.findById(loanId)
            .orElseThrow(() -> new BankikoException("Loan not found", HttpStatus.NOT_FOUND));

        if ("CLOSED".equals(loan.getStatus())) {
            throw new BankikoException("Loan is already closed", HttpStatus.CONFLICT);
        }

        // Mark all remaining installments as paid
        repaymentRepository.findByLoanIdOrderByInstallmentNo(loanId).stream()
            .filter(i -> i.getStatus() != LoanRepayment.RepaymentStatus.PAID)
            .forEach(i -> {
                i.setStatus(LoanRepayment.RepaymentStatus.PAID);
                i.setAmountPaid(i.getAmountDue());
                i.setPaidAt(Instant.now());
                repaymentRepository.save(i);
            });

        loan.setStatus("CLOSED");
        loan.setOutstandingBalance(BigDecimal.ZERO);
        loan = loanRepository.save(loan);

        pushService.sendToUser(loan.getUser(), "Loan Closed", "Your loan from " + loan.getGroupName() + " is now fully paid.");
        log.info("Loan marked paid: loanId={} by adminId={}", loanId, adminUser.getId());
        return toResponse(loan);
    }

    private void generateRepaymentSchedule(Loan loan, SaccoGroup.InterestType interestType) {
        int n = loan.getRepaymentMonths();
        BigDecimal principal = loan.getPrincipal();
        // Monthly interest rate = annualRate / 12 / 100
        BigDecimal monthlyRate = loan.getInterestRate() != null
            ? loan.getInterestRate().divide(BigDecimal.valueOf(1200), 10, RoundingMode.HALF_UP)
            : BigDecimal.ZERO;

        LocalDate base = LocalDate.now();
        List<LoanRepayment> schedule = new ArrayList<>();

        if (interestType == SaccoGroup.InterestType.FLAT_RATE || monthlyRate.compareTo(BigDecimal.ZERO) == 0) {
            // Flat rate: interest = principal × annualRate/100 × years; spread equally
            BigDecimal totalInterest = loan.getTotalInterest() != null ? loan.getTotalInterest() : BigDecimal.ZERO;
            BigDecimal monthly = principal.add(totalInterest)
                .divide(BigDecimal.valueOf(n), 2, RoundingMode.HALF_UP);
            for (int i = 1; i <= n; i++) {
                schedule.add(LoanRepayment.builder()
                    .loan(loan).installmentNo(i).dueDate(base.plusMonths(i)).amountDue(monthly).build());
            }
        } else {
            // Reducing balance (PMT formula): M = P × r(1+r)^n / ((1+r)^n - 1)
            BigDecimal onePlusR = BigDecimal.ONE.add(monthlyRate);
            BigDecimal pow = onePlusR.pow(n);  // (1+r)^n — BigDecimal.pow only accepts int, fine for ≤360
            BigDecimal pmt = principal.multiply(monthlyRate).multiply(pow)
                .divide(pow.subtract(BigDecimal.ONE), 2, RoundingMode.HALF_UP);

            BigDecimal balance = principal;
            for (int i = 1; i <= n; i++) {
                BigDecimal interest = balance.multiply(monthlyRate).setScale(2, RoundingMode.HALF_UP);
                BigDecimal principalPart = pmt.subtract(interest);
                balance = balance.subtract(principalPart).max(BigDecimal.ZERO);
                // Last installment: clear any rounding remainder
                BigDecimal due = (i == n) ? pmt.add(balance) : pmt;
                schedule.add(LoanRepayment.builder()
                    .loan(loan).installmentNo(i).dueDate(base.plusMonths(i)).amountDue(due).build());
            }
        }

        repaymentRepository.saveAll(schedule);
    }

    private BigDecimal calculateTotalInterest(
            BigDecimal principal, BigDecimal annualRate, SaccoGroup.InterestType type, int months) {
        if (annualRate == null || annualRate.compareTo(BigDecimal.ZERO) == 0) return BigDecimal.ZERO;
        if (type == SaccoGroup.InterestType.FLAT_RATE) {
            // total interest = principal × annualRate/100 × (months/12)
            return principal.multiply(annualRate)
                .multiply(BigDecimal.valueOf(months))
                .divide(BigDecimal.valueOf(1200), 2, RoundingMode.HALF_UP);
        }
        // Reducing balance: total = n × PMT - principal
        BigDecimal monthlyRate = annualRate.divide(BigDecimal.valueOf(1200), 10, RoundingMode.HALF_UP);
        BigDecimal onePlusR = BigDecimal.ONE.add(monthlyRate);
        BigDecimal pow = onePlusR.pow(months);
        BigDecimal pmt = principal.multiply(monthlyRate).multiply(pow)
            .divide(pow.subtract(BigDecimal.ONE), 2, RoundingMode.HALF_UP);
        return pmt.multiply(BigDecimal.valueOf(months)).subtract(principal).max(BigDecimal.ZERO);
    }

    private LoanResponse toResponse(Loan loan) {
        return LoanResponse.builder()
            .id(loan.getId())
            .fineractLoanId(loan.getFineractLoanId())
            .principal(loan.getPrincipal())
            .repaymentMonths(loan.getRepaymentMonths())
            .status(loan.getStatus())
            .groupName(loan.getGroupName())
            .purpose(loan.getPurpose())
            .interestRate(loan.getInterestRate())
            .interestType(loan.getInterestType())
            .totalInterest(loan.getTotalInterest())
            .outstandingBalance(loan.getOutstandingBalance())
            .appliedAt(loan.getAppliedAt())
            .disbursedAt(loan.getDisbursedAt())
            .build();
    }
}
