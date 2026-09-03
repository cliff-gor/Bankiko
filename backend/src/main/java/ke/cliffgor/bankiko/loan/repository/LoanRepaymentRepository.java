package ke.cliffgor.bankiko.loan.repository;

import ke.cliffgor.bankiko.loan.model.LoanRepayment;
import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LoanRepaymentRepository extends JpaRepository<LoanRepayment, UUID> {
    List<LoanRepayment> findByLoanIdOrderByInstallmentNo(UUID loanId);
    Optional<LoanRepayment> findFirstByLoanIdAndStatusOrderByInstallmentNo(UUID loanId, LoanRepayment.RepaymentStatus status);

    @Query("SELECT r FROM LoanRepayment r WHERE r.status = 'PENDING' AND r.dueDate < :today")
    List<LoanRepayment> findPendingDueBefore(@Param("today") LocalDate today);
}
