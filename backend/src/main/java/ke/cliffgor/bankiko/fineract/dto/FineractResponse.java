package ke.cliffgor.bankiko.fineract.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class FineractResponse {
    private Long resourceId;
    private Long officeId;
    private Long clientId;
    private Long loanId;
    private Long savingsId;
    private Long subResourceId;
    private String resourceExternalId;

    // For balance queries
    private BigDecimal accountBalance;
    private BigDecimal availableBalance;
    private String accountNo;
    private String status;
    private Map<String, Object> summary;
}
