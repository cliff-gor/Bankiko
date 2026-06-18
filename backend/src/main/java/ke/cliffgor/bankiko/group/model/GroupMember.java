package ke.cliffgor.bankiko.group.model;

import jakarta.persistence.*;
import ke.cliffgor.bankiko.member.model.Member;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "group_members",
    uniqueConstraints = @UniqueConstraint(columnNames = {"group_id", "member_id"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupMember {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", nullable = false)
    private SaccoGroup group;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private GroupRole role = GroupRole.MEMBER;

    @Builder.Default
    private Instant joinedAt = Instant.now();

    public enum GroupRole {
        MEMBER, ADMIN
    }
}
