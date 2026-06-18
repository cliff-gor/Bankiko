package ke.cliffgor.bankiko.mpesa.service;

import ke.cliffgor.bankiko.auth.model.User;
import ke.cliffgor.bankiko.common.config.BankikoProperties;
import ke.cliffgor.bankiko.common.exception.BankikoException;
import ke.cliffgor.bankiko.mpesa.model.MpesaTransaction;
import ke.cliffgor.bankiko.mpesa.repository.MpesaTransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Handles B2C (Business to Customer) payouts — remittances from the SACCO wallet to a member's M-Pesa.
 * Fineract withdrawal must succeed before this is called.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class B2CService {

    @Qualifier("mpesaWebClient")
    private final WebClient mpesaWebClient;
    private final BankikoProperties properties;
    private final DarajaTokenService tokenService;
    private final MpesaTransactionRepository transactionRepository;

    @Transactional
    public MpesaTransaction payout(User user, BigDecimal amount, String phone, String remarks) {
        BankikoProperties.Mpesa cfg = properties.getMpesa();
        String normalizedPhone = normalizePhone(phone);

        Map<String, Object> body = Map.of(
            "InitiatorName", cfg.getB2cInitiatorName(),
            "SecurityCredential", cfg.getB2cSecurityCredential(),
            "CommandID", "BusinessPayment",
            "Amount", amount.intValue(),
            "PartyA", cfg.getShortcode(),
            "PartyB", normalizedPhone,
            "Remarks", remarks != null ? remarks : "SACCO Withdrawal",
            "QueueTimeOutURL", cfg.getB2cQueueTimeoutUrl(),
            "ResultURL", cfg.getB2cCallbackUrl(),
            "Occasion", "BANKIKO_WITHDRAWAL"
        );

        Map<?, ?> response = mpesaWebClient.post()
            .uri("/mpesa/b2c/v3/paymentrequest")
            .header("Authorization", "Bearer " + tokenService.getAccessToken())
            .bodyValue(body)
            .retrieve()
            .bodyToMono(Map.class)
            .doOnError(e -> log.error("B2C API call failed for user {}", user.getId(), e))
            .block();

        if (response == null || !"0".equals(String.valueOf(response.get("ResponseCode")))) {
            String desc = response != null ? (String) response.get("ResponseDescription") : "No response";
            throw new BankikoException("B2C payout failed: " + desc, HttpStatus.BAD_GATEWAY);
        }

        MpesaTransaction tx = MpesaTransaction.builder()
            .user(user)
            .amount(amount)
            .phone(normalizedPhone)
            .type(MpesaTransaction.TransactionType.WITHDRAWAL)
            .merchantRequestId((String) response.get("ConversationID"))
            .status(MpesaTransaction.TransactionStatus.PENDING)
            .build();

        transactionRepository.save(tx);
        log.info("B2C payout initiated: conversationId={} userId={} amount={}", tx.getMerchantRequestId(), user.getId(), amount);
        return tx;
    }

    private String normalizePhone(String phone) {
        if (phone.startsWith("0")) return "254" + phone.substring(1);
        if (phone.startsWith("+")) return phone.substring(1);
        return phone;
    }
}
