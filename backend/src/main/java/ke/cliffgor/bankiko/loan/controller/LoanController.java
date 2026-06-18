package ke.cliffgor.bankiko.loan.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import ke.cliffgor.bankiko.auth.model.User;
import ke.cliffgor.bankiko.loan.dto.LoanApplicationRequest;
import ke.cliffgor.bankiko.loan.dto.LoanResponse;
import ke.cliffgor.bankiko.loan.service.LoanService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.UUID;

@Tag(name = "Loans")
@RestController
@RequestMapping("/api/loans")
@RequiredArgsConstructor
public class LoanController {

    private final LoanService loanService;

    @Operation(summary = "Apply for a loan from the group lending pool")
    @PostMapping
    public ResponseEntity<LoanResponse> apply(
        @AuthenticationPrincipal User user,
        @Valid @RequestBody LoanApplicationRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(loanService.apply(user, request));
    }

    @Operation(summary = "Approve and disburse a loan (group admin only)")
    @PreAuthorize("hasRole('GROUP_ADMIN') or hasRole('SYSTEM_ADMIN')")
    @PostMapping("/{fineractLoanId}/disburse")
    public ResponseEntity<LoanResponse> disburse(
        @AuthenticationPrincipal User adminUser,
        @PathVariable Long fineractLoanId,
        @RequestParam UUID borrowerUserId
    ) {
        return ResponseEntity.ok(loanService.approveAndDisburse(adminUser, fineractLoanId, borrowerUserId));
    }

    @Operation(summary = "Make a loan repayment")
    @PostMapping("/{fineractLoanId}/repay")
    public ResponseEntity<Void> repay(
        @AuthenticationPrincipal User user,
        @PathVariable Long fineractLoanId,
        @RequestParam BigDecimal amount
    ) {
        loanService.repay(user, fineractLoanId, amount);
        return ResponseEntity.noContent().build();
    }
}
