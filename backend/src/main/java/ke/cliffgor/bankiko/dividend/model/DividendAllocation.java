package ke.cliffgor.bankiko.dividend.model;

import jakarta.persistence.*;
import ke.cliffgor.bankiko.member.model.Member;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "dividend_allocations")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DividendAllocation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cycle_id", nullable = false)
    private DividendCycle cycle;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(nullable = false)
    private int shares;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Builder.Default
    private boolean paid = false;

    private Instant paidAt;

    @Builder.Default
    private Instant createdAt = Instant.now();
}
