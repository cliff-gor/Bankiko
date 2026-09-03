package ke.cliffgor.bankiko.group.model;

import jakarta.persistence.*;
import ke.cliffgor.bankiko.auth.model.User;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "group_invites")
@Getter @Setter
public class GroupInvite {

    @Id
    @GeneratedValue(generator = "uuid2")
    @GenericGenerator(name = "uuid2", strategy = "uuid2")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", nullable = false)
    private SaccoGroup group;

    @Column(nullable = false, unique = true, length = 64)
    private String token;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    private Integer maxUses;

    @Column(nullable = false)
    private int useCount = 0;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public boolean isExpired() {
        return LocalDateTime.now().isAfter(expiresAt);
    }

    public boolean isExhausted() {
        return maxUses != null && useCount >= maxUses;
    }

    public boolean isValid() {
        return !isExpired() && !isExhausted();
    }
}
