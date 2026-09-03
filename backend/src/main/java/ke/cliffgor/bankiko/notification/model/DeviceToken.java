package ke.cliffgor.bankiko.notification.model;

import jakarta.persistence.*;
import ke.cliffgor.bankiko.auth.model.User;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "device_tokens",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "token"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String token;

    @Builder.Default
    private String platform = "FCM";

    @Builder.Default
    private Instant createdAt = Instant.now();
}
