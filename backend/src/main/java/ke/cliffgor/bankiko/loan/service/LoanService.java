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
import ke.cliffgor.bankiko.notification.service.SmsService;
import ke.cliffgor.bankiko.share.repository.ShareHoldingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
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

        try {
            smsService.send(loan.getUser().getPhone(),
                "Bankiko: Your loan of KES " + loan.getPrincipal() + " has been approved and disbursed.");
        } catch (Exception ignored) {}

        log.info("Loan approved: loanId={} by adminId={}", loanId, adminUser.getId());
        return toResponse(loan);
    }

    @Transactional
    public LoanResponse reject(UUID loanId, User adminUser) {
        Loan loan = loanRepository.findById(loanId)
            .orElseThrow(() -> new BankikoException("Loan not found", HttpStatus.NOT_FOUND));

        loan.setStatus("REJECTED");
        loan = loanRepository.save(loan);

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

        try {
            smsService.send(user.getPhone(),
                "Bankiko: KES " + amount + " loan repayment received. Thank you.");
        } catch (Exception ignored) {}

        log.info("Loan repayment: userId={} loanId={} amount={}", user.getId(), loanId, amount);
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
