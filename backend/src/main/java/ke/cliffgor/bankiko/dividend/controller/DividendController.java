package ke.cliffgor.bankiko.dividend.controller;

import ke.cliffgor.bankiko.auth.model.User;
import ke.cliffgor.bankiko.dividend.model.DividendAllocation;
import ke.cliffgor.bankiko.dividend.model.DividendCycle;
import ke.cliffgor.bankiko.dividend.service.DividendService;
import ke.cliffgor.bankiko.member.service.MemberService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/dividends")
@RequiredArgsConstructor
public class DividendController {

    private final DividendService dividendService;
    private final MemberService memberService;

    /** Admin: declare dividend for a group */
    @PostMapping("/groups/{groupId}/declare")
    public ResponseEntity<DividendCycle> declare(
        @PathVariable UUID groupId,
        @RequestBody DeclareDividendRequest req
    ) {
        return ResponseEntity.ok(dividendService.declareDividend(groupId, req.getTotalProfit(), req.getYear()));
    }

    /** Admin: trigger payout for a declared cycle */
    @PostMapping("/cycles/{cycleId}/pay")
    public ResponseEntity<DividendCycle> pay(@PathVariable UUID cycleId) {
        return ResponseEntity.ok(dividendService.payDividend(cycleId));
    }

    /** List all cycles for a group */
    @GetMapping("/groups/{groupId}/cycles")
    public ResponseEntity<List<DividendCycle>> cycles(@PathVariable UUID groupId) {
        return ResponseEntity.ok(dividendService.listCycles(groupId));
    }

    /** List allocations in a cycle */
    @GetMapping("/cycles/{cycleId}/allocations")
    public ResponseEntity<List<DividendAllocation>> allocations(@PathVariable UUID cycleId) {
        return ResponseEntity.ok(dividendService.listAllocations(cycleId));
    }

    /** Member: my pending (unpaid) dividends */
    @GetMapping("/my")
    public ResponseEntity<List<DividendAllocation>> myDividends(@AuthenticationPrincipal User user) {
        var member = memberService.requireActiveByUserId(user.getId());
        return ResponseEntity.ok(dividendService.myDividends(member.getId()));
    }

    @Data
    static class DeclareDividendRequest {
        private BigDecimal totalProfit;
        private Integer year;
    }
}
