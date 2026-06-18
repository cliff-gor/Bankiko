package ke.cliffgor.bankiko.mpesa.service;

import ke.cliffgor.bankiko.common.config.BankikoProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Base64;
import java.util.Map;

/**
 * Fetches and caches the Daraja OAuth token.
 * Token TTL is 3600s — we cache for 3500s and refresh via scheduled eviction.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DarajaTokenService {

    @Qualifier("mpesaWebClient")
    private final WebClient mpesaWebClient;
    private final BankikoProperties properties;

    @Cacheable("mpesa-token")
    public String getAccessToken() {
        BankikoProperties.Mpesa cfg = properties.getMpesa();
        String credentials = Base64.getEncoder().encodeToString(
            (cfg.getConsumerKey() + ":" + cfg.getConsumerSecret()).getBytes()
        );

        Map<?, ?> response = mpesaWebClient.get()
            .uri("/oauth/v1/generate?grant_type=client_credentials")
            .header("Authorization", "Basic " + credentials)
            .retrieve()
            .bodyToMono(Map.class)
            .doOnError(e -> log.error("Daraja token fetch failed", e))
            .block();

        return response != null ? (String) response.get("access_token") : null;
    }

    // Evict every 58 minutes so the next call re-fetches before the 60-minute Daraja TTL
    @Scheduled(fixedDelay = 3_480_000)
    @CacheEvict(value = "mpesa-token", allEntries = true)
    public void evictToken() {
        log.debug("Evicted Daraja access token cache");
    }
}
