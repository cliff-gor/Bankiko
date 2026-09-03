package ke.cliffgor.bankiko.share.repository;

import ke.cliffgor.bankiko.share.model.ShareHolding;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ShareHoldingRepository extends JpaRepository<ShareHolding, UUID> {
    Optional<ShareHolding> findByGroupIdAndMemberId(UUID groupId, UUID memberId);
    List<ShareHolding> findByGroupIdOrderBySharesHeldDesc(UUID groupId);
    List<ShareHolding> findByMemberId(UUID memberId);
}
