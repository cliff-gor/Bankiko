package ke.cliffgor.bankiko.dividend.repository;

import ke.cliffgor.bankiko.dividend.model.DividendCycle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DividendCycleRepository extends JpaRepository<DividendCycle, UUID> {
    Optional<DividendCycle> findByGroupIdAndCycleYear(UUID groupId, int year);
    List<DividendCycle> findByGroupIdOrderByCycleYearDesc(UUID groupId);
}
