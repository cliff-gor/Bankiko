package ke.cliffgor.bankiko.notification.repository;

import ke.cliffgor.bankiko.notification.model.DeviceToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeviceTokenRepository extends JpaRepository<DeviceToken, UUID> {
    List<DeviceToken> findByUserId(UUID userId);
    Optional<DeviceToken> findByUserIdAndToken(UUID userId, String token);
    void deleteByUserIdAndToken(UUID userId, String token);
}
