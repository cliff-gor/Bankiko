package ke.cliffgor.bankiko.mpesa.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class StkPushRequest {

    @NotNull
    @DecimalMin("1.00")
    private BigDecimal amount;

    // Accept both 07XXXXXXXX and +2547XXXXXXXX
    @NotBlank
    @Pattern(regexp = "^(\\+254|0)[17]\\d{8}$", message = "Enter a valid Kenyan phone number")
    private String phone;
}
