package ke.cliffgor.bankiko.fineract.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class FineractTransactionRequest {
    private BigDecimal transactionAmount;
    private String transactionDate;
    private String dateFormat;
    private String locale;
    private String paymentTypeId;
    private String accountNumber;
    private String checkNumber;
    private String routingCode;
    private String receiptNumber;
    private String bankNumber;
}
