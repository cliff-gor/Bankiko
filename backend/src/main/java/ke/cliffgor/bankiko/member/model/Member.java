package ke.cliffgor.bankiko.member.model;

import jakarta.persistence.*;
import ke.cliffgor.bankiko.auth.model.User;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "members")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Member {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(nullable = false, unique = true)
    private User user;

    // Fineract client ID — assigned after onboarding into Fineract
    private Long fineractClientId;

    // Fineract savings account ID for the member's individual wallet
    private Long fineractSavingsAccountId;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private MemberStatus status = MemberStatus.PENDING_ONBOARDING;

    @Builder.Default
    private Instant createdAt = Instant.now();

    private Instant onboardedAt;

    // Local balance used when Fineract is unavailable (dev/simulation mode)
    @Builder.Default
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal localBalance = BigDecimal.ZERO;

    public enum MemberStatus {
        PENDING_ONBOARDING, ACTIVE, SUSPENDED
    }
}
