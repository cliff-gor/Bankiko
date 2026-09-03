package ke.cliffgor.bankiko.notification.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import ke.cliffgor.bankiko.auth.model.User;
import ke.cliffgor.bankiko.common.config.BankikoProperties;
import ke.cliffgor.bankiko.notification.model.DeviceToken;
import ke.cliffgor.bankiko.notification.repository.DeviceTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Sends FCM push notifications via the Firebase Cloud Messaging v1 HTTP API.
 *
 * Required Render env vars:
 *   FCM_PROJECT_ID         — Firebase project ID (from Firebase console → Project settings)
 *   FCM_SERVICE_ACCOUNT_JSON — base64-encoded service account JSON (from Firebase console → Service accounts)
 *
 * To encode: base64 -i serviceAccountKey.json | tr -d '\n'
 *
 * If FCM_PROJECT_ID is blank, all push sends are skipped gracefully (SMS still works).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PushNotificationService {

    private final BankikoProperties properties;
    private final DeviceTokenRepository deviceTokenRepository;
    private final ObjectMapper objectMapper;

    @Async
    public void sendToUser(UUID userId, String title, String body) {
        List<DeviceToken> tokens = deviceTokenRepository.findByUserId(userId);
        if (tokens.isEmpty()) return;
        tokens.forEach(t -> sendToToken(t.getToken(), title, body));
    }

    @Async
    public void sendToUser(User user, String title, String body) {
        sendToUser(user.getId(), title, body);
    }

    private void sendToToken(String fcmToken, String title, String body) {
        BankikoProperties.Fcm cfg = properties.getFcm();
        if (cfg.getProjectId() == null || cfg.getProjectId().isBlank()) {
            log.debug("Push skipped (FCM_PROJECT_ID not set): title={}", title);
            return;
        }
        if (cfg.getServiceAccountJson() == null || cfg.getServiceAccountJson().isBlank()) {
            log.debug("Push skipped (FCM_SERVICE_ACCOUNT_JSON not set): title={}", title);
            return;
        }

        try {
            String accessToken = getAccessToken(cfg.getServiceAccountJson());
            String url = "https://fcm.googleapis.com/v1/projects/" + cfg.getProjectId() + "/messages:send";

            Map<String, Object> message = Map.of(
                "message", Map.of(
                    "token", fcmToken,
                    "notification", Map.of("title", title, "body", body),
                    "android", Map.of("priority", "high"),
                    "apns", Map.of("headers", Map.of("apns-priority", "10"))
                )
            );

            WebClient.create().post()
                .uri(url)
                .header("Authorization", "Bearer " + accessToken)
                .header("Content-Type", "application/json")
                .bodyValue(objectMapper.writeValueAsString(message))
                .retrieve()
                .toBodilessEntity()
                .doOnError(e -> log.warn("FCM push failed for token={}: {}", fcmToken.substring(0, 10) + "...", e.getMessage()))
                .subscribe(res -> log.debug("Push sent: status={}", res.getStatusCode()));

        } catch (Exception e) {
            log.warn("Push notification error: {}", e.getMessage());
        }
    }

    /**
     * Obtains a short-lived OAuth2 access token using the service account credentials.
     * Uses Google's token endpoint with a signed JWT assertion.
     */
    private String getAccessToken(String serviceAccountJsonB64) throws Exception {
        byte[] decoded = java.util.Base64.getDecoder().decode(serviceAccountJsonB64);
        @SuppressWarnings("unchecked")
        Map<String, String> sa = objectMapper.readValue(decoded, Map.class);

        String clientEmail = sa.get("client_email");
        String privateKeyPem = sa.get("private_key");

        // Build JWT header.payload
        long now = System.currentTimeMillis() / 1000;
        String header = java.util.Base64.getUrlEncoder().withoutPadding()
            .encodeToString("{\"alg\":\"RS256\",\"typ\":\"JWT\"}".getBytes());
        String payload = java.util.Base64.getUrlEncoder().withoutPadding()
            .encodeToString(objectMapper.writeValueAsBytes(Map.of(
                "iss", clientEmail,
                "sub", clientEmail,
                "aud", "https://oauth2.googleapis.com/token",
                "scope", "https://www.googleapis.com/auth/firebase.messaging",
                "iat", now,
                "exp", now + 3600
            )));

        String toSign = header + "." + payload;

        // Load private key
        String pemContent = privateKeyPem
            .replace("-----BEGIN PRIVATE KEY-----", "")
            .replace("-----END PRIVATE KEY-----", "")
            .replaceAll("\\s", "");
        byte[] keyBytes = java.util.Base64.getDecoder().decode(pemContent);
        java.security.KeyFactory kf = java.security.KeyFactory.getInstance("RSA");
        java.security.PrivateKey pk = kf.generatePrivate(new java.security.spec.PKCS8EncodedKeySpec(keyBytes));

        java.security.Signature sig = java.security.Signature.getInstance("SHA256withRSA");
        sig.initSign(pk);
        sig.update(toSign.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        String signature = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(sig.sign());

        String jwtAssertion = toSign + "." + signature;

        // Exchange JWT for access token
        String tokenResponse = WebClient.create("https://oauth2.googleapis.com")
            .post()
            .uri("/token")
            .header("Content-Type", "application/x-www-form-urlencoded")
            .bodyValue("grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + jwtAssertion)
            .retrieve()
            .bodyToMono(String.class)
            .block();

        @SuppressWarnings("unchecked")
        Map<String, Object> tokenJson = objectMapper.readValue(tokenResponse, Map.class);
        return (String) tokenJson.get("access_token");
    }
}
