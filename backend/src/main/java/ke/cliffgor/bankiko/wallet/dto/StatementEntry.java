package ke.cliffgor.bankiko.wallet.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
public class StatementEntry {
    private String id;
    private String type;       // DEPOSIT, WITHDRAWAL, CONTRIBUTION, LOAN_DISBURSEMENT, SHARE_PURCHASE, LOAN_REPAYMENT
    private String description;
    private BigDecimal amount;
    private String status;     // SUCCESS, PENDING, PAID, FAILED
    private String reference;
    private Instant createdAt;
}
