package ke.cliffgor.bankiko.common.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

@Data
@Validated
@ConfigurationProperties(prefix = "bankiko")
public class BankikoProperties {

    private final Fineract fineract = new Fineract();
    private final Jwt jwt = new Jwt();
    private final Mpesa mpesa = new Mpesa();
    private final AfricaTalking africaTalking = new AfricaTalking();

    @Data
    public static class Fineract {
        @NotBlank
        private String baseUrl;
        @NotBlank
        private String tenant;
        @NotBlank
        private String username;
        @NotBlank
        private String password;
        private int connectTimeoutSeconds = 10;
        private int readTimeoutSeconds = 30;
    }

    @Data
    public static class Jwt {
        @NotBlank
        private String secret;
        @Positive
        private int accessExpiryMinutes = 15;
        @Positive
        private int refreshExpiryDays = 7;
    }

    @Data
    public static class Mpesa {
        private String baseUrl = "https://sandbox.safaricom.co.ke";
        private String consumerKey;
        private String consumerSecret;
        private String shortcode;
        private String passkey;
        private String callbackUrl;
        private String b2cCallbackUrl;
        private String b2cQueueTimeoutUrl;
        private String b2cInitiatorName;
        private String b2cSecurityCredential;
        private boolean simulateCallback = false;
    }

    @Data
    public static class AfricaTalking {
        private String apiKey;
        private String username = "sandbox";
        private String senderId = "BANKIKO";
    }
}
