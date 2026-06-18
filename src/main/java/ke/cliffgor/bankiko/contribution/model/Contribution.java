package ke.cliffgor.bankiko.contribution.model;

import jakarta.persistence.*;
import ke.cliffgor.bankiko.group.model.SaccoGroup;
import ke.cliffgor.bankiko.member.model.Member;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.YearMonth;
import java.util.UUID;

@Entity
@Table(name = "contributions",
    uniqueConstraints = @UniqueConstraint(columnNames = {"member_id", "group_id", "contribution_month"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Contribution {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", nullable = false)
    private SaccoGroup group;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    // YYYY-MM — one record per member per group per month
    @Column(nullable = false)
    private String contributionMonth;

    private String mpesaReceiptNumber;

    @Builder.Default
    private Instant paidAt = Instant.now();
}
