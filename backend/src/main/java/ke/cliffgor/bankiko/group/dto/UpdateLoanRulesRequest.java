package ke.cliffgor.bankiko.group.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import ke.cliffgor.bankiko.group.model.SaccoGroup;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpdateLoanRulesRequest {

    @DecimalMin("0.00") @DecimalMax("100.00")
    private BigDecimal annualInterestRate;

    private SaccoGroup.InterestType interestType;

    @Min(1) @Max(20)
    private Integer loanMultiplier;

    @Min(0) @Max(24)
    private Integer minContributionsRequired;

    @DecimalMin("0.00") @DecimalMax("100.00")
    private BigDecimal latePenaltyRate;
}
