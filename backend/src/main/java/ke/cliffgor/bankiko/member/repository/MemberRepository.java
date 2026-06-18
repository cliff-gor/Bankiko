package ke.cliffgor.bankiko.member.repository;

import ke.cliffgor.bankiko.member.model.Member;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface MemberRepository extends JpaRepository<Member, UUID> {

    @Query("SELECT m FROM Member m JOIN FETCH m.user u WHERE u.id = :userId")
    Optional<Member> findByUserId(UUID userId);

    Optional<Member> findByFineractClientId(Long fineractClientId);
}
