package ke.cliffgor.bankiko.dividend.model;

import jakarta.persistence.*;
import ke.cliffgor.bankiko.group.model.SaccoGroup;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "dividend_cycles")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DividendCycle {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", nullable = false)
    private SaccoGroup group;

    @Column(nullable = false)
    private int cycleYear;

    @Column(nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal totalProfit = BigDecimal.ZERO;

    private Instant declaredAt;
    private Instant paidAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Status status = Status.DRAFT;

    @Builder.Default
    private Instant createdAt = Instant.now();

    public enum Status { DRAFT, DECLARED, PAID }
}
