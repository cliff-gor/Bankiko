package ke.cliffgor.bankiko.dividend.service;

import ke.cliffgor.bankiko.common.exception.BankikoException;
import ke.cliffgor.bankiko.dividend.model.DividendAllocation;
import ke.cliffgor.bankiko.dividend.model.DividendCycle;
import ke.cliffgor.bankiko.dividend.repository.DividendAllocationRepository;
import ke.cliffgor.bankiko.dividend.repository.DividendCycleRepository;
import ke.cliffgor.bankiko.group.model.SaccoGroup;
import ke.cliffgor.bankiko.group.service.GroupService;
import ke.cliffgor.bankiko.member.model.Member;
import ke.cliffgor.bankiko.notification.service.PushNotificationService;
import ke.cliffgor.bankiko.notification.service.SmsService;
import ke.cliffgor.bankiko.share.repository.ShareHoldingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class DividendService {

    private final DividendCycleRepository cycleRepository;
    private final DividendAllocationRepository allocationRepository;
    private final ShareHoldingRepository shareHoldingRepository;
    private final GroupService groupService;
    private final SmsService smsService;
    private final PushNotificationService pushService;

    /**
     * Admin declares a dividend for the current (or specified) year.
     * Allocates profit proportionally to each member's share holdings.
     */
    @Transactional
    public DividendCycle declareDividend(UUID groupId, BigDecimal totalProfit, Integer year) {
        SaccoGroup group = groupService.requireGroup(groupId);
        if (group.getGroupType() != SaccoGroup.GroupType.SACCO) {
            throw new BankikoException("Dividends are only applicable to SACCO groups", HttpStatus.BAD_REQUEST);
        }

        int cycleYear = year != null ? year : LocalDate.now().getYear();

        if (cycleRepository.findByGroupIdAndCycleYear(groupId, cycleYear).isPresent()) {
            throw new BankikoException("Dividend for " + cycleYear + " already declared", HttpStatus.CONFLICT);
        }

        var holdings = shareHoldingRepository.findByGroupIdOrderBySharesHeldDesc(groupId);
        int totalShares = holdings.stream().mapToInt(h -> h.getSharesHeld()).sum();

        if (totalShares == 0) {
            throw new BankikoException("No share holdings in this group — cannot allocate dividends", HttpStatus.BAD_REQUEST);
        }

        DividendCycle cycle = cycleRepository.save(DividendCycle.builder()
            .group(group)
            .cycleYear(cycleYear)
            .totalProfit(totalProfit)
            .status(DividendCycle.Status.DECLARED)
            .declaredAt(Instant.now())
            .build());

        // Allocate proportionally: member share / total shares × total profit
        BigDecimal totalSharesBD = BigDecimal.valueOf(totalShares);
        for (var h : holdings) {
            if (h.getSharesHeld() == 0) continue;
            BigDecimal memberAmount = totalProfit
                .multiply(BigDecimal.valueOf(h.getSharesHeld()))
                .divide(totalSharesBD, 2, RoundingMode.HALF_UP);

            allocationRepository.save(DividendAllocation.builder()
                .cycle(cycle)
                .member(h.getMember())
                .shares(h.getSharesHeld())
                .amount(memberAmount)
                .build());
        }

        log.info("Dividend declared: groupId={} year={} totalProfit={}", groupId, cycleYear, totalProfit);
        return cycle;
    }

    /**
     * Marks all allocations in a cycle as PAID and notifies members.
     * In production you'd trigger B2C payouts here per member.
     */
    @Transactional
    public DividendCycle payDividend(UUID cycleId) {
        DividendCycle cycle = cycleRepository.findById(cycleId)
            .orElseThrow(() -> new BankikoException("Dividend cycle not found", HttpStatus.NOT_FOUND));

        if (cycle.getStatus() != DividendCycle.Status.DECLARED) {
            throw new BankikoException("Cycle is not in DECLARED state", HttpStatus.CONFLICT);
        }

        List<DividendAllocation> allocations = allocationRepository.findByCycleId(cycleId);
        for (DividendAllocation alloc : allocations) {
            alloc.setPaid(true);
            alloc.setPaidAt(Instant.now());
            allocationRepository.save(alloc);

            Member member = alloc.getMember();
            String msg = "Bankiko: KES " + alloc.getAmount() + " dividend for " + cycle.getCycleYear() +
                " (" + alloc.getShares() + " shares) credited to your account.";
            try { smsService.send(member.getUser().getPhone(), msg); } catch (Exception ignored) {}
            pushService.sendToUser(member.getUser(), "Dividend Paid 🎉",
                "KES " + alloc.getAmount() + " dividend for " + cycle.getCycleYear());
        }

        cycle.setStatus(DividendCycle.Status.PAID);
        cycle.setPaidAt(Instant.now());
        return cycleRepository.save(cycle);
    }

    @Transactional(readOnly = true)
    public List<DividendCycle> listCycles(UUID groupId) {
        return cycleRepository.findByGroupIdOrderByCycleYearDesc(groupId);
    }

    @Transactional(readOnly = true)
    public List<DividendAllocation> listAllocations(UUID cycleId) {
        return allocationRepository.findByCycleId(cycleId);
    }

    @Transactional(readOnly = true)
    public List<DividendAllocation> myDividends(UUID memberId) {
        return allocationRepository.findByMemberIdAndPaidFalse(memberId);
    }
}
