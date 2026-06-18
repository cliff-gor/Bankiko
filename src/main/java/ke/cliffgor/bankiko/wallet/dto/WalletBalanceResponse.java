package ke.cliffgor.bankiko.wallet.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class WalletBalanceResponse {
    private Long fineractSavingsAccountId;
    private String accountNo;
    private BigDecimal availableBalance;
    private BigDecimal accountBalance;
}
