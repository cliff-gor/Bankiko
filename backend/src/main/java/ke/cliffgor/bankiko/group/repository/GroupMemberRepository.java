package ke.cliffgor.bankiko.group.repository;

import ke.cliffgor.bankiko.group.model.GroupMember;
import ke.cliffgor.bankiko.group.model.SaccoGroup;
import ke.cliffgor.bankiko.member.model.Member;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface GroupMemberRepository extends JpaRepository<GroupMember, UUID> {

    Optional<GroupMember> findByGroupAndMember(SaccoGroup group, Member member);

    boolean existsByGroupAndMember(SaccoGroup group, Member member);

    List<GroupMember> findByGroup(SaccoGroup group);
}
