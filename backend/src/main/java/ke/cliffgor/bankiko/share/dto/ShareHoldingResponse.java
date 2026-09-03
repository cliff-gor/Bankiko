package ke.cliffgor.bankiko.share.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
public class ShareHoldingResponse {
    private UUID groupId;
    private String groupName;
    private int sharesHeld;
    private BigDecimal totalInvested;
    private BigDecimal sharePrice;
    private int loanMultiplier;
    private BigDecimal maxLoanEligible;
    private int minShares;
    private int maxShares;
    private String memberName;
}
