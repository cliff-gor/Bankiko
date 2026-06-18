package ke.cliffgor.bankiko.member.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import ke.cliffgor.bankiko.auth.model.User;
import ke.cliffgor.bankiko.member.dto.MemberResponse;
import ke.cliffgor.bankiko.member.service.MemberService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Members")
@RestController
@RequestMapping("/api/members")
@RequiredArgsConstructor
public class MemberController {

    private final MemberService memberService;

    @Operation(summary = "Onboard the authenticated user into the SACCO (creates Fineract client + wallet)")
    @PostMapping("/onboard")
    public ResponseEntity<MemberResponse> onboard(@AuthenticationPrincipal User user) {
        return ResponseEntity.status(HttpStatus.CREATED).body(memberService.onboard(user.getId()));
    }

    @Operation(summary = "Get current member profile")
    @GetMapping("/me")
    public ResponseEntity<MemberResponse> me(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(memberService.getByUserId(user.getId()));
    }
}
