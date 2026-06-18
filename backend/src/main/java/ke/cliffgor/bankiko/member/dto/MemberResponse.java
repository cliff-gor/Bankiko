package ke.cliffgor.bankiko.member.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class MemberResponse {
    private String id;
    private String userId;
    private String fullName;
    private String phone;
    private Long fineractClientId;
    private Long fineractSavingsAccountId;
    private String status;
    private Instant onboardedAt;
}
