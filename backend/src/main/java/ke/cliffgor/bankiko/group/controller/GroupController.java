package ke.cliffgor.bankiko.group.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import ke.cliffgor.bankiko.auth.model.User;
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

import java.util.UUID;

@Tag(name = "Groups")
@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class GroupController {

    private final GroupService groupService;

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
    public ResponseEntity<GroupResponse> get(@PathVariable UUID groupId) {
        return ResponseEntity.ok(groupService.get(groupId));
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
