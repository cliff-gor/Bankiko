package ke.cliffgor.bankiko.common.exception;

import org.springframework.http.HttpStatus;

public class FineractException extends BankikoException {

    public FineractException(String detail) {
        super("Fineract error: " + detail, HttpStatus.BAD_GATEWAY);
    }

    public FineractException(String detail, HttpStatus status) {
        super("Fineract error: " + detail, status);
    }
}
