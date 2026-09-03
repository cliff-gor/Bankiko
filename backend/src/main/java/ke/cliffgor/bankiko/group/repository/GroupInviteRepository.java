package ke.cliffgor.bankiko.group.repository;

import ke.cliffgor.bankiko.group.model.GroupInvite;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface GroupInviteRepository extends JpaRepository<GroupInvite, UUID> {
    Optional<GroupInvite> findByToken(String token);
}
