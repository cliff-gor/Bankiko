package ke.cliffgor.bankiko.notification.controller;

import ke.cliffgor.bankiko.auth.model.User;
import ke.cliffgor.bankiko.notification.model.DeviceToken;
import ke.cliffgor.bankiko.notification.repository.DeviceTokenRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/device-tokens")
@RequiredArgsConstructor
public class DeviceTokenController {

    private final DeviceTokenRepository tokenRepository;

    /** Register or refresh the FCM token for the current device */
    @PostMapping
    @Transactional
    public ResponseEntity<Void> register(
        @AuthenticationPrincipal User user,
        @RequestBody RegisterTokenRequest req
    ) {
        tokenRepository.findByUserIdAndToken(user.getId(), req.getToken())
            .orElseGet(() -> tokenRepository.save(DeviceToken.builder()
                .user(user)
                .token(req.getToken())
                .platform(req.getPlatform() != null ? req.getPlatform() : "FCM")
                .build()));
        return ResponseEntity.noContent().build();
    }

    /** Remove token on logout / permission revoked */
    @DeleteMapping
    @Transactional
    public ResponseEntity<Void> unregister(
        @AuthenticationPrincipal User user,
        @RequestBody RegisterTokenRequest req
    ) {
        tokenRepository.deleteByUserIdAndToken(user.getId(), req.getToken());
        return ResponseEntity.noContent().build();
    }

    @Data
    static class RegisterTokenRequest {
        private String token;
        private String platform;
    }
}
