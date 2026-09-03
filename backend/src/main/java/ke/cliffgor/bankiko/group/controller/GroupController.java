package ke.cliffgor.bankiko.group.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import ke.cliffgor.bankiko.auth.model.User;
import ke.cliffgor.bankiko.auth.repository.UserRepository;
import ke.cliffgor.bankiko.group.dto.CreateGroupRequest;
import ke.cliffgor.bankiko.group.dto.GroupResponse;
import ke.cliffgor.bankiko.group.service.GroupService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@Tag(name = "Groups")
@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class GroupController {

    private final GroupService groupService;
    private final UserRepository userRepository;

    @Operation(summary = "Create a new SACCO group")
    @PostMapping
    public ResponseEntity<GroupResponse> create(
        @AuthenticationPrincipal User user,
        @Valid @RequestBody CreateGroupRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(groupService.create(user.getId(), request));
    }

    @Operation(summary = "List groups the current user belongs to")
    @GetMapping
    public ResponseEntity<Page<GroupResponse>> list(
        @AuthenticationPrincipal User user,
        Pageable pageable
    ) {
        return ResponseEntity.ok(groupService.listForUser(user.getId(), pageable));
    }

    @Operation(summary = "Get group details")
    @GetMapping("/{groupId}")
    public ResponseEntity<GroupResponse> get(
        @PathVariable UUID groupId,
        @AuthenticationPrincipal User user
    ) {
        return ResponseEntity.ok(groupService.get(groupId, user.getId()));
    }

    @Operation(summary = "Look up a user by phone or email for group invite")
    @GetMapping("/users/lookup")
    public ResponseEntity<?> lookupUser(@RequestParam String q) {
        var user = userRepository.findByPhone(q)
            .or(() -> userRepository.findByEmail(q))
            .map(u -> Map.of("id", u.getId(), "fullName", u.getFullName(), "phone", u.getPhone(), "email", u.getEmail()));
        return user.<ResponseEntity<?>>map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @Operation(summary = "Get group treasury pool balance")
    @GetMapping("/{groupId}/balance")
    public ResponseEntity<?> getBalance(
        @PathVariable UUID groupId,
        @AuthenticationPrincipal User user
    ) {
        return ResponseEntity.ok(groupService.getPoolBalance(groupId, user.getId()));
    }

    @Operation(summary = "Get members who have not contributed this month (defaulters)")
    @GetMapping("/{groupId}/defaulters")
    public ResponseEntity<?> getDefaulters(
        @PathVariable UUID groupId,
        @AuthenticationPrincipal User user
    ) {
        return ResponseEntity.ok(groupService.getDefaulters(groupId, user.getId()));
    }

    @Operation(summary = "Add a member to the group (admin only)")
    @PostMapping("/{groupId}/members/{targetUserId}")
    public ResponseEntity<Void> addMember(
        @PathVariable UUID groupId,
        @PathVariable UUID targetUserId,
        @AuthenticationPrincipal User user
    ) {
        groupService.addMember(groupId, targetUserId, user.getId());
        return ResponseEntity.noContent().build();
    }
}
