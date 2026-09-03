package ke.cliffgor.bankiko.share.service;

import ke.cliffgor.bankiko.auth.model.User;
import ke.cliffgor.bankiko.common.exception.BankikoException;
import ke.cliffgor.bankiko.group.model.SaccoGroup;
import ke.cliffgor.bankiko.group.service.GroupService;
import ke.cliffgor.bankiko.member.model.Member;
import ke.cliffgor.bankiko.member.service.MemberService;
import ke.cliffgor.bankiko.mpesa.model.MpesaTransaction;
import ke.cliffgor.bankiko.mpesa.service.StkPushService;
import ke.cliffgor.bankiko.share.dto.ShareHoldingResponse;
import ke.cliffgor.bankiko.share.model.ShareHolding;
import ke.cliffgor.bankiko.share.repository.ShareHoldingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ShareService {

    private final ShareHoldingRepository holdingRepository;
    private final MemberService memberService;
    private final GroupService groupService;
    private final StkPushService stkPushService;

    /**
     * Initiates an STK push to buy shares in a SACCO group.
     * The actual credit happens in creditShares() after M-Pesa confirms.
     */
    @Transactional
    public MpesaTransaction buyShares(User user, UUID groupId, int numberOfShares, String phone) {
        Member member = memberService.requireActiveByUserId(user.getId());
        SaccoGroup group = groupService.requireGroup(groupId);

        if (group.getGroupType() != SaccoGroup.GroupType.SACCO) {
            throw new BankikoException("Only SACCO groups support share purchases", HttpStatus.BAD_REQUEST);
        }
        if (group.getStatus() != SaccoGroup.GroupStatus.ACTIVE) {
            throw new BankikoException("Group is not active", HttpStatus.BAD_REQUEST);
        }

        groupService.requireMembership(group, user.getId());

        // Validate share count limits
        Optional<ShareHolding> existing = holdingRepository.findByGroupIdAndMemberId(groupId, member.getId());
        int currentShares = existing.map(ShareHolding::getSharesHeld).orElse(0);
        if (currentShares + numberOfShares > group.getMaxShares()) {
            throw new BankikoException(
                "Purchase would exceed max shares (" + group.getMaxShares() + "). You hold " + currentShares + ".",
                HttpStatus.BAD_REQUEST);
        }

        BigDecimal amount = group.getSharePrice().multiply(BigDecimal.valueOf(numberOfShares));

        MpesaTransaction tx = stkPushService.initiate(
            user, amount, phone,
            MpesaTransaction.TransactionType.SHARE_PURCHASE,
            groupId
        );

        log.info("Share purchase initiated: userId={} groupId={} shares={} amount={}", user.getId(), groupId, numberOfShares, amount);
        return tx;
    }

    /**
     * Called by WalletService.processMpesaPayment() after a successful SHARE_PURCHASE transaction.
     * Credits the shares to the member's holding.
     */
    @Transactional
    public void creditShares(MpesaTransaction tx) {
        Member member = memberService.requireActiveByUserId(tx.getUser().getId());
        UUID groupId = tx.getGroupId();
        if (groupId == null) {
            log.error("SHARE_PURCHASE tx {} has no groupId — cannot credit shares", tx.getId());
            return;
        }

        SaccoGroup group = groupService.requireGroup(groupId);
        int numberOfShares = tx.getAmount().divide(group.getSharePrice(), 0, java.math.RoundingMode.DOWN).intValue();

        ShareHolding holding = holdingRepository.findByGroupIdAndMemberId(groupId, member.getId())
            .orElseGet(() -> ShareHolding.builder()
                .group(group)
                .member(member)
                .build());

        holding.setSharesHeld(holding.getSharesHeld() + numberOfShares);
        holding.setTotalInvested(holding.getTotalInvested().add(tx.getAmount()));
        holding.setUpdatedAt(Instant.now());
        holdingRepository.save(holding);

        log.info("Shares credited: userId={} groupId={} shares={} total={}", tx.getUser().getId(), groupId, numberOfShares, holding.getSharesHeld());
    }

    @Transactional(readOnly = true)
    public ShareHoldingResponse getMyHolding(User user, UUID groupId) {
        Member member = memberService.requireActiveByUserId(user.getId());
        SaccoGroup group = groupService.requireGroup(groupId);

        ShareHolding holding = holdingRepository.findByGroupIdAndMemberId(groupId, member.getId())
            .orElseGet(() -> ShareHolding.builder().group(group).member(member).build());

        return toResponse(holding, group);
    }

    @Transactional(readOnly = true)
    public List<ShareHoldingResponse> getGroupRegister(UUID groupId) {
        SaccoGroup group = groupService.requireGroup(groupId);
        return holdingRepository.findByGroupIdOrderBySharesHeldDesc(groupId)
            .stream().map(h -> toResponse(h, group)).collect(Collectors.toList());
    }

    private ShareHoldingResponse toResponse(ShareHolding h, SaccoGroup group) {
        BigDecimal maxLoan = group.getSharePrice()
            .multiply(BigDecimal.valueOf(h.getSharesHeld()))
            .multiply(BigDecimal.valueOf(group.getLoanMultiplier()));

        return ShareHoldingResponse.builder()
            .groupId(group.getId())
            .groupName(group.getName())
            .sharesHeld(h.getSharesHeld())
            .totalInvested(h.getTotalInvested())
            .sharePrice(group.getSharePrice())
            .loanMultiplier(group.getLoanMultiplier())
            .maxLoanEligible(maxLoan)
            .minShares(group.getMinShares())
            .maxShares(group.getMaxShares())
            .memberName(h.getMember() != null && h.getMember().getUser() != null
                ? h.getMember().getUser().getFullName() : null)
            .build();
    }
}
