package ke.cliffgor.bankiko.common.exception;

import org.springframework.http.HttpStatus;

public class ResourceNotFoundException extends BankikoException {

    public ResourceNotFoundException(String resource, Object id) {
        super(resource + " not found: " + id, HttpStatus.NOT_FOUND);
    }
}
