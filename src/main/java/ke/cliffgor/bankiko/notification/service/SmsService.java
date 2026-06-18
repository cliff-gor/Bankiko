package ke.cliffgor.bankiko.notification.service;

import ke.cliffgor.bankiko.common.config.BankikoProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;

/**
 * Sends SMS via Africa's Talking API.
 * All sends are async — SMS delivery must never block a financial transaction.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SmsService {

    private final BankikoProperties properties;

    @Async
    public void send(String phone, String message) {
        BankikoProperties.AfricaTalking cfg = properties.getAfricaTalking();

        if (cfg.getApiKey() == null || cfg.getApiKey().isBlank()) {
            log.info("SMS (sandbox disabled — no AT_API_KEY): to={} msg={}", phone, message);
            return;
        }

        try {
            WebClient.builder()
                .baseUrl("https://api.africastalking.com")
                .build()
                .post()
                .uri("/version1/messaging")
                .header("apiKey", cfg.getApiKey())
                .header("Accept", "application/json")
                .bodyValue(Map.of(
                    "username", cfg.getUsername(),
                    "to", phone,
                    "message", message,
                    "from", cfg.getSenderId()
                ))
                .retrieve()
                .toBodilessEntity()
                .doOnError(e -> log.error("SMS send failed to {}", phone, e))
                .subscribe(res -> log.debug("SMS sent to {}: status={}", phone, res.getStatusCode()));
        } catch (Exception e) {
            log.error("SMS send error to {}", phone, e);
        }
    }
}
