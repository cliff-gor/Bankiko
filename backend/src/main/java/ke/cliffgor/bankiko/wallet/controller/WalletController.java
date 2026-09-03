package ke.cliffgor.bankiko.wallet.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import ke.cliffgor.bankiko.auth.model.User;
import ke.cliffgor.bankiko.contribution.repository.ContributionRepository;
import ke.cliffgor.bankiko.loan.repository.LoanRepaymentRepository;
import ke.cliffgor.bankiko.loan.repository.LoanRepository;
import ke.cliffgor.bankiko.member.service.MemberService;
import ke.cliffgor.bankiko.mpesa.dto.StkPushRequest;
import ke.cliffgor.bankiko.mpesa.model.MpesaTransaction;
import ke.cliffgor.bankiko.mpesa.repository.MpesaTransactionRepository;
import ke.cliffgor.bankiko.wallet.dto.StatementEntry;
import ke.cliffgor.bankiko.wallet.dto.WalletBalanceResponse;
import ke.cliffgor.bankiko.wallet.dto.WithdrawRequest;
import ke.cliffgor.bankiko.wallet.service.WalletService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Tag(name = "Wallet")
@RestController
@RequestMapping("/api/wallet")
@RequiredArgsConstructor
public class WalletController {

    private final WalletService walletService;
    private final MpesaTransactionRepository transactionRepository;
    private final ContributionRepository contributionRepository;
    private final LoanRepository loanRepository;
    private final LoanRepaymentRepository repaymentRepository;
    private final MemberService memberService;

    @Operation(summary = "Get wallet balance")
    @GetMapping("/balance")
    public ResponseEntity<WalletBalanceResponse> balance(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(walletService.getBalance(user));
    }

    @Operation(summary = "List transaction history for current user")
    @GetMapping("/transactions")
    public ResponseEntity<Page<MpesaTransaction>> transactions(
        @AuthenticationPrincipal User user,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(
            transactionRepository.findByUserIdOrderByCreatedAtDesc(user.getId(), PageRequest.of(page, size))
        );
    }

    @Operation(summary = "Deposit via M-Pesa STK push")
    @PostMapping("/deposit")
    public ResponseEntity<MpesaTransaction> deposit(
        @AuthenticationPrincipal User user,
        @Valid @RequestBody StkPushRequest request
    ) {
        return ResponseEntity.accepted()
            .body(walletService.initiateDeposit(user, request.getAmount(), request.getPhone()));
    }

    @Operation(summary = "Full member statement — all financial events sorted newest first")
    @GetMapping("/statement")
    public ResponseEntity<List<StatementEntry>> statement(@AuthenticationPrincipal User user) {
        var member = memberService.requireActiveByUserId(user.getId());
        List<StatementEntry> entries = new ArrayList<>();

        // M-Pesa transactions (deposits, withdrawals, contributions, share purchases, loan disbursements)
        transactionRepository.findByUserIdOrderByCreatedAtDesc(user.getId(), PageRequest.of(0, 500))
            .forEach(tx -> entries.add(StatementEntry.builder()
                .id(tx.getId().toString())
                .type(tx.getType().name())
                .description(typeLabel(tx.getType().name()) + (tx.getGroupId() != null ? " (group)" : ""))
                .amount(tx.getAmount())
                .status(tx.getStatus().name())
                .reference(tx.getMpesaReceiptNumber())
                .createdAt(tx.getCreatedAt())
                .build()));

        // Contributions (SUCCESS records from ContributionService — already captured as CONTRIBUTION tx above,
        // but also add them from contributions table so group name is available)
        contributionRepository.findAll().stream()
            .filter(c -> c.getMember().getId().equals(member.getId()))
            .forEach(c -> {
                // Only add if not already represented as a tx (same receipt)
                boolean duplicate = entries.stream().anyMatch(e -> c.getMpesaReceiptNumber() != null && c.getMpesaReceiptNumber().equals(e.getReference()));
                if (!duplicate) {
                    entries.add(StatementEntry.builder()
                        .id(c.getId().toString())
                        .type("CONTRIBUTION")
                        .description("Contribution — " + c.getGroup().getName() + " (" + c.getContributionMonth() + ")")
                        .amount(c.getAmount())
                        .status("SUCCESS")
                        .reference(c.getMpesaReceiptNumber())
                        .createdAt(c.getPaidAt())
                        .build());
                }
            });

        // Loan repayments made (PAID installments)
        loanRepository.findByUserIdOrderByAppliedAtDesc(user.getId()).forEach(loan ->
            repaymentRepository.findByLoanIdOrderByInstallmentNo(loan.getId()).stream()
                .filter(r -> r.getStatus().name().equals("PAID"))
                .forEach(r -> entries.add(StatementEntry.builder()
                    .id(r.getId().toString())
                    .type("LOAN_REPAYMENT")
                    .description("Loan repayment — " + loan.getGroupName() + " (installment " + r.getInstallmentNo() + ")")
                    .amount(r.getAmountPaid())
                    .status("PAID")
                    .reference(loan.getId().toString().substring(0, 8).toUpperCase())
                    .createdAt(r.getPaidAt())
                    .build())));

        entries.sort(Comparator.comparing(StatementEntry::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())));
        return ResponseEntity.ok(entries);
    }

    private String typeLabel(String type) {
        return switch (type) {
            case "DEPOSIT" -> "Wallet deposit";
            case "WITHDRAWAL" -> "Withdrawal";
            case "CONTRIBUTION" -> "Group contribution";
            case "LOAN_DISBURSEMENT" -> "Loan disbursement";
            case "SHARE_PURCHASE" -> "Share purchase";
            default -> type;
        };
    }

    @Operation(summary = "Withdraw to M-Pesa")
    @PostMapping("/withdraw")
    public ResponseEntity<MpesaTransaction> withdraw(
        @AuthenticationPrincipal User user,
        @Valid @RequestBody WithdrawRequest request
    ) {
        return ResponseEntity.accepted()
            .body(walletService.withdraw(user, request));
    }
}
