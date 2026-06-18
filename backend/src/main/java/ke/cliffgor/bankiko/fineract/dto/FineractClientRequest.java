package ke.cliffgor.bankiko.fineract.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class FineractClientRequest {
    private String firstname;
    private String lastname;
    private String mobileNo;
    private String externalId;
    private Integer officeId;
    private String dateFormat;
    private String locale;
    private String activationDate;
    private boolean active;
}
