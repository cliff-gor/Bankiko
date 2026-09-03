package ke.cliffgor.bankiko.loan.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import ke.cliffgor.bankiko.auth.model.User;
import ke.cliffgor.bankiko.loan.dto.LoanApplicationRequest;
import ke.cliffgor.bankiko.loan.dto.LoanResponse;
import ke.cliffgor.bankiko.loan.model.LoanRepayment;
import ke.cliffgor.bankiko.loan.service.LoanService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Tag(name = "Loans")
@RestController
@RequestMapping("/api/loans")
@RequiredArgsConstructor
public class LoanController {

    private final LoanService loanService;

    @Operation(summary = "List my loans")
    @GetMapping
    public ResponseEntity<List<LoanResponse>> list(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(loanService.listForUser(user.getId()));
    }

    @Operation(summary = "Apply for a loan from the group lending pool")
    @PostMapping
    public ResponseEntity<LoanResponse> apply(
        @AuthenticationPrincipal User user,
        @Valid @RequestBody LoanApplicationRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(loanService.apply(user, request));
    }

    @Operation(summary = "List all pending loan applications (admin)")
    @GetMapping("/pending")
    @PreAuthorize("hasRole('SYSTEM_ADMIN')")
    public ResponseEntity<List<LoanResponse>> pending() {
        return ResponseEntity.ok(loanService.listPending());
    }

    @Operation(summary = "Approve a loan (admin)")
    @PostMapping("/{loanId}/approve")
    @PreAuthorize("hasRole('SYSTEM_ADMIN')")
    public ResponseEntity<LoanResponse> approve(
        @PathVariable UUID loanId,
        @AuthenticationPrincipal User adminUser
    ) {
        return ResponseEntity.ok(loanService.approve(loanId, adminUser));
    }

    @Operation(summary = "Reject a loan (admin)")
    @PostMapping("/{loanId}/reject")
    @PreAuthorize("hasRole('SYSTEM_ADMIN')")
    public ResponseEntity<LoanResponse> reject(
        @PathVariable UUID loanId,
        @AuthenticationPrincipal User adminUser
    ) {
        return ResponseEntity.ok(loanService.reject(loanId, adminUser));
    }

    @Operation(summary = "Get repayment schedule for a loan")
    @GetMapping("/{loanId}/schedule")
    public ResponseEntity<List<LoanRepayment>> schedule(@PathVariable UUID loanId) {
        return ResponseEntity.ok(loanService.listRepayments(loanId));
    }

    @Operation(summary = "Make a loan repayment")
    @PostMapping("/{loanId}/repay")
    public ResponseEntity<Void> repay(
        @AuthenticationPrincipal User user,
        @PathVariable UUID loanId,
        @RequestParam BigDecimal amount
    ) {
        loanService.repay(user, loanId, amount);
        return ResponseEntity.noContent().build();
    }
}
