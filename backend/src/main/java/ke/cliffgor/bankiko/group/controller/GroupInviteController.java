package ke.cliffgor.bankiko.group.controller;

import ke.cliffgor.bankiko.auth.model.User;
import ke.cliffgor.bankiko.group.dto.InviteResponse;
import ke.cliffgor.bankiko.group.service.GroupInviteService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class GroupInviteController {

    private final GroupInviteService inviteService;

    /** Admin/group-admin creates an invite link */
    @PostMapping("/api/groups/{groupId}/invites")
    public InviteResponse createInvite(
        @PathVariable UUID groupId,
        @RequestParam(defaultValue = "168") int ttlHours,   // 7 days default
        @RequestParam(required = false) Integer maxUses,
        @AuthenticationPrincipal User user
    ) {
        return inviteService.createInvite(groupId, user, ttlHours, maxUses);
    }

    /** Public endpoint — anyone with the link can preview group details */
    @GetMapping("/api/invites/{token}")
    public InviteResponse getInvite(@PathVariable String token) {
        return inviteService.getInviteDetails(token);
    }

    /** Authenticated user joins group via invite */
    @PostMapping("/api/invites/{token}/join")
    public ResponseEntity<Map<String, Object>> joinViaInvite(
        @PathVariable String token,
        @AuthenticationPrincipal User user
    ) {
        InviteResponse invite = inviteService.joinViaInvite(token, user);
        return ResponseEntity.ok(Map.of(
            "message", "Successfully joined " + invite.groupName(),
            "groupId", invite.groupId(),
            "groupType", invite.groupType()
        ));
    }
}
