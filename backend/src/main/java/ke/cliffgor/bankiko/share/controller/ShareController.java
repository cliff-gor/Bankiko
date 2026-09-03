package ke.cliffgor.bankiko.share.controller;

import ke.cliffgor.bankiko.auth.model.User;
import ke.cliffgor.bankiko.share.dto.BuySharesRequest;
import ke.cliffgor.bankiko.share.dto.ShareHoldingResponse;
import ke.cliffgor.bankiko.share.service.ShareService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/shares")
@RequiredArgsConstructor
public class ShareController {

    private final ShareService shareService;

    /** Initiate STK push to buy shares in a group */
    @PostMapping("/buy")
    public ResponseEntity<?> buyShares(
        @AuthenticationPrincipal User user,
        @RequestBody BuySharesRequest req
    ) {
        var tx = shareService.buyShares(user, req.getGroupId(), req.getNumberOfShares(), req.getPhone());
        return ResponseEntity.ok(tx);
    }

    /** Get the calling member's holding in a specific group */
    @GetMapping("/groups/{groupId}/my-holding")
    public ResponseEntity<ShareHoldingResponse> getMyHolding(
        @AuthenticationPrincipal User user,
        @PathVariable UUID groupId
    ) {
        return ResponseEntity.ok(shareService.getMyHolding(user, groupId));
    }

    /** Get the full share register for a group (admin or group admin view) */
    @GetMapping("/groups/{groupId}/register")
    public ResponseEntity<List<ShareHoldingResponse>> getRegister(@PathVariable UUID groupId) {
        return ResponseEntity.ok(shareService.getGroupRegister(groupId));
    }
}
