package ke.cliffgor.bankiko.contribution.service;

import ke.cliffgor.bankiko.auth.model.User;
import ke.cliffgor.bankiko.common.exception.BankikoException;
import ke.cliffgor.bankiko.contribution.dto.ContributeRequest;
import ke.cliffgor.bankiko.contribution.dto.ContributionResponse;
import ke.cliffgor.bankiko.contribution.model.Contribution;
import ke.cliffgor.bankiko.contribution.repository.ContributionRepository;
import ke.cliffgor.bankiko.fineract.client.FineractClient;
import ke.cliffgor.bankiko.group.model.SaccoGroup;
import ke.cliffgor.bankiko.group.service.GroupService;
import ke.cliffgor.bankiko.member.model.Member;
import ke.cliffgor.bankiko.member.service.MemberService;
import ke.cliffgor.bankiko.mpesa.model.MpesaTransaction;
import ke.cliffgor.bankiko.mpesa.service.StkPushService;
import ke.cliffgor.bankiko.notification.service.SmsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ContributionService {

    private final ContributionRepository contributionRepository;
    private final MemberService memberService;
    private final GroupService groupService;
    private final StkPushService stkPushService;
    private final FineractClient fineractClient;
    private final SmsService smsService;

    /**
     * Initiates an M-Pesa STK push for a group contribution.
     * The actual Fineract credit happens in processGroupContribution() after M-Pesa confirms.
     */
    @Transactional
    public MpesaTransaction initiateContribution(User user, UUID groupId, ContributeRequest request) {
        Member member = memberService.requireActiveByUserId(user.getId());
        SaccoGroup group = groupService.requireGroup(groupId);
        groupService.requireMembership(group, user.getId());

        String currentMonth = YearMonth.now().toString();
        if (contributionRepository.findByMemberAndGroupAndContributionMonth(member, group, currentMonth).isPresent()) {
            throw new BankikoException("Contribution for this month already made", HttpStatus.CONFLICT);
        }

        return stkPushService.initiate(user, request.getAmount(), request.getPhone(),
            MpesaTransaction.TransactionType.CONTRIBUTION, groupId);
    }

    /**
     * Called after M-Pesa payment confirmed. Credits the group pool in Fineract
     * and records the contribution for this member/month.
     */
    @Transactional
    public void processGroupContribution(Member member, UUID groupId, BigDecimal amount, String receipt) {
        SaccoGroup group = groupService.requireGroup(groupId);

        // Credit the group's pooled savings account in Fineract
        fineractClient.deposit(group.getFineractGroupAccountId(), amount, receipt);

        String currentMonth = YearMonth.now().toString();
        Contribution contribution = Contribution.builder()
            .member(member)
            .group(group)
            .amount(amount)
            .contributionMonth(currentMonth)
            .mpesaReceiptNumber(receipt)
            .build();
        contributionRepository.save(contribution);

        smsService.send(member.getUser().getPhone(),
            "Bankiko: KES " + amount + " contribution recorded for " + group.getName() + ". Receipt: " + receipt);

        log.info("Group contribution processed: memberId={} groupId={} amount={}", member.getId(), groupId, amount);
    }

    @Transactional(readOnly = true)
    public Page<ContributionResponse> listForGroup(UUID groupId, Pageable pageable) {
        SaccoGroup group = groupService.requireGroup(groupId);
        return contributionRepository.findByGroupOrderByPaidAtDesc(group, pageable)
            .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<ContributionResponse> listForMemberInGroup(UUID userId, UUID groupId, Pageable pageable) {
        Member member = memberService.requireActiveByUserId(userId);
        SaccoGroup group = groupService.requireGroup(groupId);
        return contributionRepository.findByMemberAndGroupOrderByPaidAtDesc(member, group)
            .stream().map(this::toResponse)
            .collect(java.util.stream.Collectors.collectingAndThen(
                java.util.stream.Collectors.toList(),
                list -> new org.springframework.data.domain.PageImpl<>(list, pageable, list.size())
            ));
    }

    private ContributionResponse toResponse(Contribution c) {
        return ContributionResponse.builder()
            .id(c.getId().toString())
            .memberName(c.getMember().getUser().getFullName())
            .groupName(c.getGroup().getName())
            .amount(c.getAmount())
            .contributionMonth(c.getContributionMonth())
            .mpesaReceiptNumber(c.getMpesaReceiptNumber())
            .paidAt(c.getPaidAt())
            .build();
    }
}
