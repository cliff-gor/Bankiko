package ke.cliffgor.bankiko.common.outbox;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Transactional outbox: events written atomically with the business transaction,
 * then relayed asynchronously to Fineract or M-Pesa by OutboxRelay.
 * Prevents dual-write failures where DB commits but the downstream call never fires.
 */
@Entity
@Table(name = "outbox_events")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OutboxEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String eventType;

    // JSON payload for the downstream call
    @Column(nullable = false, columnDefinition = "TEXT")
    private String payload;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private OutboxStatus status = OutboxStatus.PENDING;

    @Builder.Default
    private Instant createdAt = Instant.now();

    private Instant processedAt;

    private String errorMessage;

    @Version
    private Long version;

    public enum OutboxStatus {
        PENDING, PROCESSING, DONE, FAILED
    }
}
