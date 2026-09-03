package ke.cliffgor.bankiko.dividend.repository;

import ke.cliffgor.bankiko.dividend.model.DividendAllocation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DividendAllocationRepository extends JpaRepository<DividendAllocation, UUID> {
    List<DividendAllocation> findByCycleId(UUID cycleId);
    List<DividendAllocation> findByMemberIdAndPaidFalse(UUID memberId);
}
