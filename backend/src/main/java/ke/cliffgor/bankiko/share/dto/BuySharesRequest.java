package ke.cliffgor.bankiko.share.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class BuySharesRequest {
    private UUID groupId;
    private int numberOfShares;
    private String phone;
}
