package ke.cliffgor.bankiko.wallet.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import ke.cliffgor.bankiko.auth.model.User;
import ke.cliffgor.bankiko.mpesa.dto.StkPushRequest;
import ke.cliffgor.bankiko.mpesa.model.MpesaTransaction;
import ke.cliffgor.bankiko.mpesa.repository.MpesaTransactionRepository;
import ke.cliffgor.bankiko.wallet.dto.WalletBalanceResponse;
import ke.cliffgor.bankiko.wallet.dto.WithdrawRequest;
import ke.cliffgor.bankiko.wallet.service.WalletService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Wallet")
@RestController
@RequestMapping("/api/wallet")
@RequiredArgsConstructor
public class WalletController {

    private final WalletService walletService;
    private final MpesaTransactionRepository transactionRepository;

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
