package ke.cliffgor.bankiko.loan.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
public class LoanResponse {
    private Long fineractLoanId;
    private BigDecimal principal;
    private int repaymentMonths;
    private String status;
    private String groupName;
    private Instant appliedAt;
}
