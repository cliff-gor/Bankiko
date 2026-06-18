package ke.cliffgor.bankiko.loan.service;

import ke.cliffgor.bankiko.auth.model.User;
import ke.cliffgor.bankiko.common.exception.BankikoException;
import ke.cliffgor.bankiko.fineract.client.FineractClient;
import ke.cliffgor.bankiko.fineract.dto.FineractResponse;
import ke.cliffgor.bankiko.group.model.SaccoGroup;
import ke.cliffgor.bankiko.group.service.GroupService;
import ke.cliffgor.bankiko.loan.dto.LoanApplicationRequest;
import ke.cliffgor.bankiko.loan.dto.LoanResponse;
import ke.cliffgor.bankiko.member.model.Member;
import ke.cliffgor.bankiko.member.service.MemberService;
import ke.cliffgor.bankiko.mpesa.service.B2CService;
import ke.cliffgor.bankiko.notification.service.SmsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class LoanService {

    private final FineractClient fineractClient;
    private final MemberService memberService;
    private final GroupService groupService;
    private final B2CService b2cService;
    private final SmsService smsService;

    @Value("${bankiko.fineract.loan-product-id:1}")
    private int loanProductId;

    /**
     * Applies for a loan against the group lending pool.
     * Admin approval is required before disbursement.
     */
    @Transactional
    public LoanResponse apply(User user, LoanApplicationRequest request) {
        Member member = memberService.requireActiveByUserId(user.getId());
        SaccoGroup group = groupService.requireGroup(request.getGroupId());
        groupService.requireMembership(group, user.getId());

        FineractResponse loanResponse = fineractClient.applyLoan(
            member.getFineractClientId(),
            loanProductId,
            request.getPrincipal(),
            request.getRepaymentMonths(),
            "loan-" + user.getId() + "-" + UUID.randomUUID().toString().substring(0, 8)
        );

        smsService.send(user.getPhone(),
            "Bankiko: Your loan application of KES " + request.getPrincipal() + " has been submitted. Awaiting group admin approval.");

        log.info("Loan application submitted: userId={} fineractLoanId={} principal={}",
            user.getId(), loanResponse.getResourceId(), request.getPrincipal());

        return LoanResponse.builder()
            .fineractLoanId(loanResponse.getResourceId())
            .principal(request.getPrincipal())
            .repaymentMonths(request.getRepaymentMonths())
            .status("PENDING_APPROVAL")
            .groupName(group.getName())
            .appliedAt(Instant.now())
            .build();
    }

    /**
     * Group admin approves a loan then disburses it to the member's M-Pesa.
     */
    @Transactional
    public LoanResponse approveAndDisburse(User adminUser, Long fineractLoanId, UUID borrowerUserId) {
        groupService.requireGroup(UUID.randomUUID()); // placeholder — production: load loan→group mapping

        fineractClient.approveLoan(fineractLoanId);
        fineractClient.disburseLoan(fineractLoanId);

        Member borrower = memberService.requireActiveByUserId(borrowerUserId);

        // Trigger B2C to send funds to borrower's phone
        FineractResponse loanDetails = fineractClient.getBalance(fineractLoanId);
        if (loanDetails.getAccountBalance() != null) {
            b2cService.payout(borrower.getUser(), loanDetails.getAccountBalance(), borrower.getUser().getPhone(), "Loan disbursement");
        }

        smsService.send(borrower.getUser().getPhone(),
            "Bankiko: Your loan has been approved and disbursed to your M-Pesa. Check your balance.");

        log.info("Loan approved and disbursed: fineractLoanId={} borrowerUserId={}", fineractLoanId, borrowerUserId);

        return LoanResponse.builder()
            .fineractLoanId(fineractLoanId)
            .status("DISBURSED")
            .appliedAt(Instant.now())
            .build();
    }

    /**
     * Records a loan repayment from a member's wallet.
     */
    @Transactional
    public void repay(User user, Long fineractLoanId, java.math.BigDecimal amount) {
        Member member = memberService.requireActiveByUserId(user.getId());
        fineractClient.repayLoan(fineractLoanId, amount, "repay-" + System.currentTimeMillis());
        smsService.send(user.getPhone(),
            "Bankiko: KES " + amount + " loan repayment received. Thank you.");
        log.info("Loan repayment: userId={} fineractLoanId={} amount={}", user.getId(), fineractLoanId, amount);
    }
}
