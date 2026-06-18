package ke.cliffgor.bankiko.contribution.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
public class ContributionResponse {
    private String id;
    private String memberName;
    private String groupName;
    private BigDecimal amount;
    private String contributionMonth;
    private String mpesaReceiptNumber;
    private Instant paidAt;
}
