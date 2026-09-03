package ke.cliffgor.bankiko.loan.model;

import jakarta.persistence.*;
import ke.cliffgor.bankiko.auth.model.User;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "loans")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Loan {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(nullable = false)
    private User user;

    @Column(nullable = false)
    private UUID groupId;

    private String groupName;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal principal;

    @Column(nullable = false)
    private int repaymentMonths;

    @Builder.Default
    private String status = "PENDING_APPROVAL";

    private String purpose;

    private Long fineractLoanId;

    @Column(precision = 5, scale = 2)
    private BigDecimal interestRate;       // annual %, snapshot at origination

    private String interestType;           // REDUCING_BALANCE | FLAT_RATE

    @Column(precision = 15, scale = 2)
    private BigDecimal totalInterest;

    @Column(precision = 15, scale = 2)
    private BigDecimal outstandingBalance;

    @Builder.Default
    private Instant appliedAt = Instant.now();

    private Instant disbursedAt;
}
