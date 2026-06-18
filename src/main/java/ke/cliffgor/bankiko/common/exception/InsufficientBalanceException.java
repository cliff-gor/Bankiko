package ke.cliffgor.bankiko.common.exception;

import org.springframework.http.HttpStatus;

public class InsufficientBalanceException extends BankikoException {

    public InsufficientBalanceException(String detail) {
        super("Insufficient balance: " + detail, HttpStatus.UNPROCESSABLE_ENTITY);
    }
}
