package ke.cliffgor.bankiko.fineract.client;

import ke.cliffgor.bankiko.common.exception.FineractException;
import ke.cliffgor.bankiko.fineract.dto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

/**
 * All Fineract API calls go through here. No other class should hold a reference
 * to the fineractWebClient bean — this is the single integration point.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FineractClient {

    private static final String DATE_FORMAT = "dd MMMM yyyy";
    private static final String LOCALE = "en";
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("dd MMMM yyyy");

    @Qualifier("fineractWebClient")
    private final WebClient webClient;

    // ── Client (member) management ────────────────────────────────────────────

    public FineractResponse createClient(String firstName, String lastName, String phone, String externalId) {
        FineractClientRequest body = FineractClientRequest.builder()
            .firstname(firstName)
            .lastname(lastName)
            .mobileNo(phone)
            .externalId(externalId)
            .officeId(1)
            .dateFormat(DATE_FORMAT)
            .locale(LOCALE)
            .activationDate(today())
            .active(true)
            .build();

        return post("/clients", body);
    }

    // ── Savings account management ────────────────────────────────────────────

    public FineractResponse openSavingsAccount(Long clientId, int productId, String externalId) {
        FineractSavingsRequest body = FineractSavingsRequest.builder()
            .clientId(clientId)
            .productId(productId)
            .submittedOnDate(today())
            .dateFormat(DATE_FORMAT)
            .locale(LOCALE)
            .externalId(externalId)
            .build();

        FineractResponse created = post("/savingsaccounts", body);

        // Approve then activate the savings account
        post("/savingsaccounts/" + created.getResourceId() + "?command=approve",
            Map.of("approvedOnDate", today(), "dateFormat", DATE_FORMAT, "locale", LOCALE));

        post("/savingsaccounts/" + created.getResourceId() + "?command=activate",
            Map.of("activatedOnDate", today(), "dateFormat", DATE_FORMAT, "locale", LOCALE));

        return created;
    }

    public FineractResponse deposit(Long savingsAccountId, BigDecimal amount, String receiptNumber) {
        FineractTransactionRequest body = FineractTransactionRequest.builder()
            .transactionAmount(amount)
            .transactionDate(today())
            .dateFormat(DATE_FORMAT)
            .locale(LOCALE)
            .receiptNumber(receiptNumber)
            .build();

        return post("/savingsaccounts/" + savingsAccountId + "/transactions?command=deposit", body);
    }

    public FineractResponse withdraw(Long savingsAccountId, BigDecimal amount, String receiptNumber) {
        FineractTransactionRequest body = FineractTransactionRequest.builder()
            .transactionAmount(amount)
            .transactionDate(today())
            .dateFormat(DATE_FORMAT)
            .locale(LOCALE)
            .receiptNumber(receiptNumber)
            .build();

        return post("/savingsaccounts/" + savingsAccountId + "/transactions?command=withdrawal", body);
    }

    public FineractResponse getBalance(Long savingsAccountId) {
        return webClient.get()
            .uri("/savingsaccounts/" + savingsAccountId)
            .retrieve()
            .bodyToMono(FineractResponse.class)
            .doOnError(e -> log.error("Fineract getBalance failed for account {}", savingsAccountId, e))
            .onErrorMap(WebClientResponseException.class, e ->
                new FineractException("getBalance: " + e.getResponseBodyAsString(), HttpStatus.BAD_GATEWAY))
            .block();
    }

    // ── Loan management ───────────────────────────────────────────────────────

    public FineractResponse applyLoan(Long clientId, int loanProductId, BigDecimal principal,
                                      int numberOfRepayments, String externalId) {
        Map<String, Object> body = new HashMap<>();
        body.put("clientId", clientId);
        body.put("productId", loanProductId);
        body.put("principal", principal);
        body.put("loanTermFrequency", numberOfRepayments);
        body.put("loanTermFrequencyType", 2);
        body.put("numberOfRepayments", numberOfRepayments);
        body.put("repaymentFrequencyType", 2);
        body.put("repaymentEvery", 1);
        body.put("interestRatePerPeriod", 0);
        body.put("amortizationType", 1);
        body.put("interestType", 0);
        body.put("interestCalculationPeriodType", 1);
        body.put("expectedDisbursementDate", today());
        body.put("submittedOnDate", today());
        body.put("dateFormat", DATE_FORMAT);
        body.put("locale", LOCALE);
        body.put("externalId", externalId);

        return post("/loans", body);
    }

    public FineractResponse approveLoan(Long loanId) {
        return post("/loans/" + loanId + "?command=approve",
            Map.of("approvedOnDate", today(), "dateFormat", DATE_FORMAT, "locale", LOCALE));
    }

    public FineractResponse disburseLoan(Long loanId) {
        return post("/loans/" + loanId + "?command=disburse",
            Map.of("actualDisbursementDate", today(), "dateFormat", DATE_FORMAT, "locale", LOCALE));
    }

    public FineractResponse repayLoan(Long loanId, BigDecimal amount, String receiptNumber) {
        Map<String, Object> body = Map.of(
            "transactionAmount", amount,
            "transactionDate", today(),
            "dateFormat", DATE_FORMAT,
            "locale", LOCALE,
            "receiptNumber", receiptNumber
        );
        return post("/loans/" + loanId + "/transactions?command=repayment", body);
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private FineractResponse post(String uri, Object body) {
        return webClient.post()
            .uri(uri)
            .bodyValue(body)
            .retrieve()
            .bodyToMono(FineractResponse.class)
            .doOnError(e -> log.error("Fineract POST {} failed", uri, e))
            .onErrorMap(WebClientResponseException.class, e ->
                new FineractException(uri + ": " + e.getResponseBodyAsString(), HttpStatus.BAD_GATEWAY))
            .block();
    }

    private String today() {
        return LocalDate.now().format(FORMATTER);
    }
}
