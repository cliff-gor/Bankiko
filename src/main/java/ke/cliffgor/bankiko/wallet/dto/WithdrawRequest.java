package ke.cliffgor.bankiko.wallet.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class WithdrawRequest {

    @NotNull
    @DecimalMin("10.00")
    private BigDecimal amount;

    @NotBlank
    @Pattern(regexp = "^(\\+254|0)[17]\\d{8}$", message = "Enter a valid Kenyan phone number")
    private String phone;

    private String remarks;
}
