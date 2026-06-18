package ke.cliffgor.bankiko.loan.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class LoanApplicationRequest {

    @NotNull
    private UUID groupId;

    @NotNull
    @DecimalMin("1000.00")
    private BigDecimal principal;

    @Min(1) @Max(24)
    private int repaymentMonths;

    private String purpose;
}
