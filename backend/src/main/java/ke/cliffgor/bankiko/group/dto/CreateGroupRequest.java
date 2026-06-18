package ke.cliffgor.bankiko.group.dto;

import jakarta.validation.constraints.*;
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
}
