package ke.cliffgor.bankiko.loan.repository;

import ke.cliffgor.bankiko.loan.model.Loan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LoanRepository extends JpaRepository<Loan, UUID> {
    List<Loan> findByUserIdOrderByAppliedAtDesc(UUID userId);
    List<Loan> findByStatusOrderByAppliedAtDesc(String status);
}
