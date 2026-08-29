package ke.cliffgor.bankiko.mpesa.service;

import ke.cliffgor.bankiko.auth.model.User;
import ke.cliffgor.bankiko.common.config.BankikoProperties;
import ke.cliffgor.bankiko.common.exception.BankikoException;
import ke.cliffgor.bankiko.mpesa.dto.StkCallback;
import ke.cliffgor.bankiko.wallet.service.WalletService;
import ke.cliffgor.bankiko.mpesa.model.MpesaTransaction;
import ke.cliffgor.bankiko.mpesa.repository.MpesaTransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class StkPushService {

    private final WebClient mpesaWebClient;
    private final BankikoProperties properties;
    private final DarajaTokenService tokenService;
    private final MpesaTransactionRepository transactionRepository;
    private final WalletService walletService;

    public StkPushService(
        @Qualifier("mpesaWebClient") WebClient mpesaWebClient,
        BankikoProperties properties,
        DarajaTokenService tokenService,
        MpesaTransactionRepository transactionRepository,
        @Lazy WalletService walletService
    ) {
        this.mpesaWebClient = mpesaWebClient;
        this.properties = properties;
        this.tokenService = tokenService;
        this.transactionRepository = transactionRepository;
        this.walletService = walletService;
    }

    /**
     * Initiates an STK push to the member's phone for a deposit or contribution.
     * Returns immediately with the pending transaction ID.
     * Fineract credit happens in the callback handler once M-Pesa confirms.
     */
    @Transactional
    public MpesaTransaction initiate(
        User user,
        BigDecimal amount,
        String phone,
        MpesaTransaction.TransactionType type,
        UUID groupId
    ) {
        BankikoProperties.Mpesa cfg = properties.getMpesa();
        String normalizedPhone = normalizePhone(phone);
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        String password = Base64.getEncoder().encodeToString(
            (cfg.getShortcode() + cfg.getPasskey() + timestamp).getBytes(StandardCharsets.UTF_8)
        );

        Map<String, Object> body = new HashMap<>();
        body.put("BusinessShortCode", cfg.getShortcode());
        body.put("Password", password);
        body.put("Timestamp", timestamp);
        body.put("TransactionType", "CustomerPayBillOnline");
        body.put("Amount", amount.intValue());
        body.put("PartyA", normalizedPhone);
        body.put("PartyB", cfg.getShortcode());
        body.put("PhoneNumber", normalizedPhone);
        body.put("CallBackURL", cfg.getCallbackUrl());
        body.put("AccountReference", "BANKIKO-" + user.getId().toString().substring(0, 8).toUpperCase());
        body.put("TransactionDesc", type == MpesaTransaction.TransactionType.DEPOSIT ? "Wallet Deposit" : "Group Contribution");

        Map<?, ?> response = mpesaWebClient.post()
            .uri("/mpesa/stkpush/v1/processrequest")
            .header("Authorization", "Bearer " + tokenService.getAccessToken())
            .bodyValue(body)
            .retrieve()
            .bodyToMono(Map.class)
            .doOnError(e -> log.error("STK push API call failed for user {}", user.getId(), e))
            .block();

        if (response == null || !"0".equals(String.valueOf(response.get("ResponseCode")))) {
            String desc = response != null ? (String) response.get("ResponseDescription") : "No response";
            throw new BankikoException("STK push failed: " + desc, HttpStatus.BAD_GATEWAY);
        }

        MpesaTransaction tx = MpesaTransaction.builder()
            .user(user)
            .amount(amount)
            .phone(normalizedPhone)
            .type(type)
            .merchantRequestId((String) response.get("MerchantRequestID"))
            .checkoutRequestId((String) response.get("CheckoutRequestID"))
            .groupId(groupId)
            .status(MpesaTransaction.TransactionStatus.PENDING)
            .build();

        transactionRepository.save(tx);
        log.info("STK push initiated: checkoutRequestId={} userId={} amount={}", tx.getCheckoutRequestId(), user.getId(), amount);

        if (properties.getMpesa().isSimulateCallback()) {
            scheduleSimulatedCallback(tx);
        }

        return tx;
    }

    private void scheduleSimulatedCallback(MpesaTransaction tx) {
        String fakeReceipt = "SIM" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase();
        log.info("[SIM] Scheduling fake STK callback in 5s for checkoutRequestId={} receipt={}", tx.getCheckoutRequestId(), fakeReceipt);

        Executors.newSingleThreadScheduledExecutor().schedule(() -> {
            try {
                StkCallback.CallbackMetadata meta = new StkCallback.CallbackMetadata();
                meta.setItems(List.of(
                    Map.of("Name", "MpesaReceiptNumber", "Value", fakeReceipt),
                    Map.of("Name", "Amount", "Value", tx.getAmount()),
                    Map.of("Name", "PhoneNumber", "Value", tx.getPhone())
                ));

                StkCallback.StkCallbackData data = new StkCallback.StkCallbackData();
                data.setMerchantRequestId(tx.getMerchantRequestId());
                data.setCheckoutRequestId(tx.getCheckoutRequestId());
                data.setResultCode(0);
                data.setResultDesc("The service request is processed successfully.");
                data.setCallbackMetadata(meta);

                StkCallback.Body body = new StkCallback.Body();
                body.setStkCallback(data);

                StkCallback fakeCallback = new StkCallback();
                fakeCallback.setBody(body);

                handleCallback(fakeCallback);

                transactionRepository.findByCheckoutRequestId(tx.getCheckoutRequestId())
                    .ifPresent(walletService::processMpesaPayment);

                log.info("[SIM] Fake STK callback processed: receipt={} amount={}", fakeReceipt, tx.getAmount());
            } catch (Exception e) {
                log.error("[SIM] Fake STK callback failed", e);
            }
        }, 5, TimeUnit.SECONDS);
    }

    @Transactional
    public void handleCallback(StkCallback callback) {
        if (callback.getData() == null) return;

        String checkoutId = callback.getData().getCheckoutRequestId();
        MpesaTransaction tx = transactionRepository.findByCheckoutRequestId(checkoutId)
            .orElseGet(() -> {
                log.warn("Received callback for unknown checkoutRequestId: {}", checkoutId);
                return null;
            });

        if (tx == null) return;

        if (callback.isSuccess()) {
            String receipt = callback.getData().getCallbackMetadata() != null
                ? callback.getData().getCallbackMetadata().getMpesaReceiptNumber()
                : null;
            tx.setMpesaReceiptNumber(receipt);
            tx.setStatus(MpesaTransaction.TransactionStatus.SUCCESS);
            tx.setCompletedAt(Instant.now());
            log.info("STK callback SUCCESS: checkoutRequestId={} receipt={}", checkoutId, receipt);
        } else {
            tx.setStatus(MpesaTransaction.TransactionStatus.FAILED);
            tx.setFailureReason(callback.getData().getResultDesc());
            tx.setCompletedAt(Instant.now());
            log.warn("STK callback FAILED: checkoutRequestId={} reason={}", checkoutId, callback.getData().getResultDesc());
        }

        transactionRepository.save(tx);
    }

    private String normalizePhone(String phone) {
        // Convert 07XXXXXXXX → 2547XXXXXXXX
        if (phone.startsWith("0")) return "254" + phone.substring(1);
        if (phone.startsWith("+")) return phone.substring(1);
        return phone;
    }
}
