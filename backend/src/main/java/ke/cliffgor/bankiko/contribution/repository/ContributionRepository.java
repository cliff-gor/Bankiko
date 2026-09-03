package ke.cliffgor.bankiko.contribution.repository;

import ke.cliffgor.bankiko.contribution.model.Contribution;
import ke.cliffgor.bankiko.group.model.SaccoGroup;
import ke.cliffgor.bankiko.member.model.Member;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ContributionRepository extends JpaRepository<Contribution, UUID> {

    Optional<Contribution> findByMemberAndGroupAndContributionMonth(Member member, SaccoGroup group, String month);

    Page<Contribution> findByGroupOrderByPaidAtDesc(SaccoGroup group, Pageable pageable);

    List<Contribution> findByMemberAndGroupOrderByPaidAtDesc(Member member, SaccoGroup group);

    long countByMemberAndGroup(Member member, SaccoGroup group);
}
