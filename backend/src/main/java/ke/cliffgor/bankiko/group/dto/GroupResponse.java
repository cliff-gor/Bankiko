package ke.cliffgor.bankiko.group.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
public class GroupResponse {
    private String id;
    private String name;
    private String description;
    private BigDecimal monthlyContributionTarget;
    private int contributionDueDay;
    private Long fineractGroupAccountId;
    private String groupType;
    private String status;
    private int memberCount;
    private String role;
    private Instant createdAt;
}
