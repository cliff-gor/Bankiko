package ke.cliffgor.bankiko.group.dto;

import jakarta.validation.constraints.*;
import ke.cliffgor.bankiko.group.model.SaccoGroup;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class CreateGroupRequest {

    @NotBlank
    private String name;

    private String description;

    @NotNull
    @DecimalMin("0.00")
    private BigDecimal monthlyContributionTarget;

    @Min(1) @Max(28)
    private int contributionDueDay = 5;

    @NotNull
    private SaccoGroup.GroupType groupType = SaccoGroup.GroupType.CHAMA;

    // SACCO only — months of contributions required before loan eligibility (default 3)
    @Min(1) @Max(24)
    private int minContributionsRequired = 3;

    // SACCO share config
    private BigDecimal sharePrice;
    @Min(1)
    private int minShares = 5;
    @Min(1)
    private int maxShares = 1000;
    @Min(1)
    private int loanMultiplier = 3;

    // Loan interest
    @DecimalMin("0.00") @DecimalMax("100.00")
    private BigDecimal annualInterestRate = new BigDecimal("12.00");

    private SaccoGroup.InterestType interestType = SaccoGroup.InterestType.REDUCING_BALANCE;

    // Penalties
    @DecimalMin("0.00") @DecimalMax("100.00")
    private BigDecimal latePenaltyRate = new BigDecimal("5.00");

    @DecimalMin("0.00")
    private BigDecimal contributionPenalty = BigDecimal.ZERO;
}
