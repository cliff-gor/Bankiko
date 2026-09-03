package ke.cliffgor.bankiko.group.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record InviteResponse(
    UUID inviteId,
    String token,
    String groupId,
    String groupName,
    String groupType,
    LocalDateTime expiresAt,
    Integer maxUses,
    int useCount,
    String inviteUrl
) {}
