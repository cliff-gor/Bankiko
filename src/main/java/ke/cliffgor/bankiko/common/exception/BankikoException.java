package ke.cliffgor.bankiko.common.exception;

import org.springframework.http.HttpStatus;

public class BankikoException extends RuntimeException {

    private final HttpStatus status;

    public BankikoException(String message, HttpStatus status) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
