package ke.cliffgor.bankiko.loan.repository;

import ke.cliffgor.bankiko.loan.model.LoanRepayment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LoanRepaymentRepository extends JpaRepository<LoanRepayment, UUID> {
    List<LoanRepayment> findByLoanIdOrderByInstallmentNo(UUID loanId);
    Optional<LoanRepayment> findFirstByLoanIdAndStatusOrderByInstallmentNo(UUID loanId, LoanRepayment.RepaymentStatus status);
}
