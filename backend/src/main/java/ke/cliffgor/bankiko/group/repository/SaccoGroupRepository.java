package ke.cliffgor.bankiko.group.repository;

import ke.cliffgor.bankiko.group.model.SaccoGroup;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface SaccoGroupRepository extends JpaRepository<SaccoGroup, UUID> {

    List<SaccoGroup> findByStatus(SaccoGroup.GroupStatus status);

    @Query("""
        SELECT DISTINCT g FROM SaccoGroup g
        JOIN g.members gm
        JOIN gm.member m
        JOIN m.user u
        WHERE u.id = :userId
        """)
    Page<SaccoGroup> findGroupsByUserId(UUID userId, Pageable pageable);
}
