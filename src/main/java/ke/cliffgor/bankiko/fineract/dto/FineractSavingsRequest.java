package ke.cliffgor.bankiko.fineract.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class FineractSavingsRequest {
    private Long clientId;
    private Integer productId;
    private String submittedOnDate;
    private String dateFormat;
    private String locale;
    private String externalId;
}
