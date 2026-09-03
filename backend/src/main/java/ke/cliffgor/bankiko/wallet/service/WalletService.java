package ke.cliffgor.bankiko.wallet.service;

import ke.cliffgor.bankiko.auth.model.User;
import ke.cliffgor.bankiko.common.exception.InsufficientBalanceException;
import ke.cliffgor.bankiko.contribution.service.ContributionService;
import ke.cliffgor.bankiko.fineract.client.FineractClient;
import ke.cliffgor.bankiko.fineract.dto.FineractResponse;
import ke.cliffgor.bankiko.member.model.Member;
import ke.cliffgor.bankiko.member.repository.MemberRepository;
import ke.cliffgor.bankiko.member.service.MemberService;
import ke.cliffgor.bankiko.mpesa.model.MpesaTransaction;
import ke.cliffgor.bankiko.mpesa.service.B2CService;
import ke.cliffgor.bankiko.mpesa.service.StkPushService;
import ke.cliffgor.bankiko.notification.service.SmsService;
import ke.cliffgor.bankiko.share.service.ShareService;
import ke.cliffgor.bankiko.wallet.dto.WalletBalanceResponse;
import ke.cliffgor.bankiko.wallet.dto.WithdrawRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Slf4j
@Service
@RequiredArgsConstructor
public class WalletService {

    private final MemberService memberService;
    private final MemberRepository memberRepository;
    private final FineractClient fineractClient;
    private final StkPushService stkPushService;
    private final B2CService b2cService;
    private final SmsService smsService;
    private final ContributionService contributionService;
    private final ShareService shareService;

    /**
     * Fetches the member's wallet balance from Fineract.
     */
    @Transactional(readOnly = true)
    public WalletBalanceResponse getBalance(User user) {
        Member member = memberService.requireActiveByUserId(user.getId());

        if (member.getFineractSavingsAccountId() == null) {
            return WalletBalanceResponse.builder()
                .fineractSavingsAccountId(null)
                .accountNo(null)
                .availableBalance(member.getLocalBalance())
                .accountBalance(member.getLocalBalance())
                .build();
        }

        try {
            FineractResponse balance = fineractClient.getBalance(member.getFineractSavingsAccountId());
            return WalletBalanceResponse.builder()
                .fineractSavingsAccountId(member.getFineractSavingsAccountId())
                .accountNo(balance.getAccountNo())
                .availableBalance(balance.getAvailableBalance())
                .accountBalance(balance.getAccountBalance())
                .build();
        } catch (Exception e) {
            log.warn("Fineract unavailable for balance check, returning zero: {}", e.getMessage());
            return WalletBalanceResponse.builder()
                .fineractSavingsAccountId(member.getFineractSavingsAccountId())
                .accountNo(null)
                .availableBalance(BigDecimal.ZERO)
                .accountBalance(BigDecimal.ZERO)
                .build();
        }
    }

    /**
     * Initiates a deposit: sends STK push to member's phone.
     * Actual Fineract credit happens in processMpesaPayment() after Daraja confirms.
     */
    @Transactional
    public MpesaTransaction initiateDeposit(User user, BigDecimal amount, String phone) {
        memberService.requireActiveByUserId(user.getId());
        return stkPushService.initiate(user, amount, phone, MpesaTransaction.TransactionType.DEPOSIT, null);
    }

    /**
     * Called by the M-Pesa callback handler after a successful STK payment.
     * Routes to either wallet deposit or group contribution based on transaction type.
     */
    @Transactional
    public void processMpesaPayment(MpesaTransaction tx) {
        if (tx.getStatus() != MpesaTransaction.TransactionStatus.SUCCESS) return;

        Member member = memberService.requireActiveByUserId(tx.getUser().getId());

        if (tx.getType() == MpesaTransaction.TransactionType.DEPOSIT) {
            if (member.getFineractSavingsAccountId() != null) {
                try {
                    fineractClient.deposit(
                        member.getFineractSavingsAccountId(),
                        tx.getAmount(),
                        tx.getMpesaReceiptNumber()
                    );
                } catch (Exception e) {
                    log.warn("Fineract deposit failed, crediting local balance instead: {}", e.getMessage());
                    member.setLocalBalance(member.getLocalBalance().add(tx.getAmount()));
                    memberRepository.save(member);
                }
            } else {
                member.setLocalBalance(member.getLocalBalance().add(tx.getAmount()));
                memberRepository.save(member);
                log.info("Local balance credited (Fineract absent): userId={} amount={} newBalance={}",
                    tx.getUser().getId(), tx.getAmount(), member.getLocalBalance());
            }
            smsService.send(tx.getPhone(),
                "Bankiko: KES " + tx.getAmount() + " deposited to your wallet. Receipt: " + tx.getMpesaReceiptNumber());
            log.info("Wallet credited: userId={} amount={}", tx.getUser().getId(), tx.getAmount());

        } else if (tx.getType() == MpesaTransaction.TransactionType.CONTRIBUTION && tx.getGroupId() != null) {
            contributionService.processGroupContribution(member, tx.getGroupId(), tx.getAmount(), tx.getMpesaReceiptNumber());

        } else if (tx.getType() == MpesaTransaction.TransactionType.SHARE_PURCHASE) {
            shareService.creditShares(tx);
            smsService.send(tx.getPhone(),
                "Bankiko: Share purchase of KES " + tx.getAmount() + " confirmed. Receipt: " + tx.getMpesaReceiptNumber());
        }
    }

    /**
     * Withdraw: debit Fineract first, then trigger B2C payout.
     * If the B2C call fails after Fineract debit, the transaction is flagged for manual review.
     */
    @Transactional
    public MpesaTransaction withdraw(User user, WithdrawRequest request) {
        Member member = memberService.requireActiveByUserId(user.getId());
        FineractResponse balance = fineractClient.getBalance(member.getFineractSavingsAccountId());

        if (balance.getAvailableBalance() == null || balance.getAvailableBalance().compareTo(request.getAmount()) < 0) {
            throw new InsufficientBalanceException("requested=" + request.getAmount() + " available=" + balance.getAvailableBalance());
        }

        // Debit Fineract before triggering M-Pesa — if M-Pesa fails, manual reconciliation is needed
        fineractClient.withdraw(member.getFineractSavingsAccountId(), request.getAmount(), "pending-b2c");

        MpesaTransaction tx = b2cService.payout(user, request.getAmount(), request.getPhone(), request.getRemarks());
        log.info("Withdrawal initiated: userId={} amount={}", user.getId(), request.getAmount());
        return tx;
    }
}
