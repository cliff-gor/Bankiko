package ke.cliffgor.bankiko.loan.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class LoanResponse {
    private UUID id;
    private Long fineractLoanId;
    private BigDecimal principal;
    private int repaymentMonths;
    private String status;
    private String groupName;
    private String purpose;
    private Instant appliedAt;
    private Instant disbursedAt;
}
