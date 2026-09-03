package ke.cliffgor.bankiko.group.model;

import jakarta.persistence.*;
import ke.cliffgor.bankiko.member.model.Member;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "sacco_groups")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SaccoGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    private String description;

    // Fineract savings account ID for the group pool
    private Long fineractGroupAccountId;

    // Monthly contribution target per member
    @Column(nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal monthlyContributionTarget = BigDecimal.ZERO;

    // Day of month contributions are due (1-28)
    @Builder.Default
    private int contributionDueDay = 5;

    // Share configuration — applies to SACCO groups only
    @Column(nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal sharePrice = new BigDecimal("200.00");

    @Builder.Default
    private int minShares = 5;

    @Builder.Default
    private int maxShares = 1000;

    // Loan ceiling = sharesHeld × loanMultiplier
    @Builder.Default
    private int loanMultiplier = 3;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private GroupType groupType = GroupType.CHAMA;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private GroupStatus status = GroupStatus.ACTIVE;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(nullable = false)
    private Member createdBy;

    @Builder.Default
    private Instant createdAt = Instant.now();

    private Instant approvedAt;
    private String rejectedReason;

    @OneToMany(mappedBy = "group", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<GroupMember> members = new ArrayList<>();

    public enum GroupType {
        CHAMA, SACCO
    }

    public enum GroupStatus {
        PENDING_APPROVAL, ACTIVE, SUSPENDED, CLOSED
    }
}
