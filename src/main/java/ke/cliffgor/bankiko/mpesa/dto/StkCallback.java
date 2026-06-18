package ke.cliffgor.bankiko.mpesa.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class StkCallback {

    @JsonProperty("Body")
    private Body body;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Body {
        @JsonProperty("stkCallback")
        private StkCallbackData stkCallback;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class StkCallbackData {
        @JsonProperty("MerchantRequestID")
        private String merchantRequestId;

        @JsonProperty("CheckoutRequestID")
        private String checkoutRequestId;

        @JsonProperty("ResultCode")
        private int resultCode;

        @JsonProperty("ResultDesc")
        private String resultDesc;

        @JsonProperty("CallbackMetadata")
        private CallbackMetadata callbackMetadata;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CallbackMetadata {
        @JsonProperty("Item")
        private List<Map<String, Object>> items;

        public String getMpesaReceiptNumber() {
            if (items == null) return null;
            return items.stream()
                .filter(i -> "MpesaReceiptNumber".equals(i.get("Name")))
                .map(i -> (String) i.get("Value"))
                .findFirst()
                .orElse(null);
        }
    }

    public boolean isSuccess() {
        return body != null
            && body.getStkCallback() != null
            && body.getStkCallback().getResultCode() == 0;
    }

    public StkCallbackData getData() {
        return body != null ? body.getStkCallback() : null;
    }
}
