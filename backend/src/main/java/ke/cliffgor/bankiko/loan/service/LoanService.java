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

        loan.setStatus("ACTIVE");
        loan.setDisbursedAt(Instant.now());
        loan = loanRepository.save(loan);

        // Generate monthly repayment schedule
        generateRepaymentSchedule(loan);

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

        // Mark the next pending installment as paid
        repaymentRepository.findFirstByLoanIdAndStatusOrderByInstallmentNo(loanId, LoanRepayment.RepaymentStatus.PENDING)
            .ifPresent(inst -> {
                inst.setAmountPaid(amount);
                inst.setStatus(LoanRepayment.RepaymentStatus.PAID);
                inst.setPaidAt(Instant.now());
                repaymentRepository.save(inst);

                // If all installments are paid, close the loan
                long remaining = repaymentRepository.findByLoanIdOrderByInstallmentNo(loanId)
                    .stream().filter(i -> i.getStatus() == LoanRepayment.RepaymentStatus.PENDING).count();
                if (remaining == 0) {
                    loan.setStatus("CLOSED");
                    loanRepository.save(loan);
                }
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

    private void generateRepaymentSchedule(Loan loan) {
        BigDecimal monthly = loan.getPrincipal().divide(
            BigDecimal.valueOf(loan.getRepaymentMonths()), 2, RoundingMode.HALF_UP);
        LocalDate base = LocalDate.now();
        List<LoanRepayment> schedule = new ArrayList<>();
        for (int i = 1; i <= loan.getRepaymentMonths(); i++) {
            schedule.add(LoanRepayment.builder()
                .loan(loan)
                .installmentNo(i)
                .dueDate(base.plusMonths(i))
                .amountDue(monthly)
                .build());
        }
        repaymentRepository.saveAll(schedule);
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
            .appliedAt(loan.getAppliedAt())
            .disbursedAt(loan.getDisbursedAt())
            .build();
    }
}
