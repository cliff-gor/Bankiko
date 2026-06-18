package ke.cliffgor.bankiko.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RegisterRequest {

    @NotBlank
    private String fullName;

    @Email
    @NotBlank
    private String email;

    // Kenyan phone format: +254XXXXXXXXX or 07XXXXXXXX
    @NotBlank
    @Pattern(regexp = "^(\\+254|0)[17]\\d{8}$", message = "Enter a valid Kenyan phone number")
    private String phone;

    @NotBlank
    @Size(min = 8, message = "Password must be at least 8 characters")
    private String password;
}
