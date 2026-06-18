package ke.cliffgor.bankiko.contribution.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import ke.cliffgor.bankiko.auth.model.User;
import ke.cliffgor.bankiko.contribution.dto.ContributeRequest;
import ke.cliffgor.bankiko.contribution.dto.ContributionResponse;
import ke.cliffgor.bankiko.contribution.service.ContributionService;
import ke.cliffgor.bankiko.mpesa.model.MpesaTransaction;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Tag(name = "Contributions")
@RestController
@RequestMapping("/api/groups/{groupId}/contributions")
@RequiredArgsConstructor
public class ContributionController {

    private final ContributionService contributionService;

    @Operation(summary = "Contribute to the group pool via M-Pesa STK push")
    @PostMapping
    public ResponseEntity<MpesaTransaction> contribute(
        @PathVariable UUID groupId,
        @AuthenticationPrincipal User user,
        @Valid @RequestBody ContributeRequest request
    ) {
        return ResponseEntity.accepted()
            .body(contributionService.initiateContribution(user, groupId, request));
    }

    @Operation(summary = "List all contributions for a group")
    @GetMapping
    public ResponseEntity<Page<ContributionResponse>> listGroupContributions(
        @PathVariable UUID groupId,
        Pageable pageable
    ) {
        return ResponseEntity.ok(contributionService.listForGroup(groupId, pageable));
    }

    @Operation(summary = "List my contributions in a group")
    @GetMapping("/mine")
    public ResponseEntity<Page<ContributionResponse>> myContributions(
        @PathVariable UUID groupId,
        @AuthenticationPrincipal User user,
        Pageable pageable
    ) {
        return ResponseEntity.ok(contributionService.listForMemberInGroup(user.getId(), groupId, pageable));
    }
}
