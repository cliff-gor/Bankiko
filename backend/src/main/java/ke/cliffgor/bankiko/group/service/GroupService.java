package ke.cliffgor.bankiko.group.service;

import ke.cliffgor.bankiko.common.exception.BankikoException;
import ke.cliffgor.bankiko.common.exception.ResourceNotFoundException;
import ke.cliffgor.bankiko.fineract.client.FineractClient;
import ke.cliffgor.bankiko.fineract.dto.FineractResponse;
import ke.cliffgor.bankiko.group.dto.CreateGroupRequest;
import ke.cliffgor.bankiko.group.dto.GroupResponse;
import ke.cliffgor.bankiko.group.model.GroupMember;
import ke.cliffgor.bankiko.group.model.SaccoGroup;
import ke.cliffgor.bankiko.group.repository.GroupMemberRepository;
import ke.cliffgor.bankiko.group.repository.SaccoGroupRepository;
import ke.cliffgor.bankiko.member.model.Member;
import ke.cliffgor.bankiko.member.service.MemberService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class GroupService {

    private final SaccoGroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final MemberService memberService;
    private final FineractClient fineractClient;

    @Value("${bankiko.fineract.group-fund-product-id:2}")
    private int groupFundProductId;

    @Transactional
    public GroupResponse create(UUID userId, CreateGroupRequest request) {
        Member creator = memberService.requireActiveByUserId(userId);

        Long fineractAccountId = null;
        try {
            FineractResponse savings = fineractClient.openSavingsAccount(
                creator.getFineractClientId(),
                groupFundProductId,
                "group-pool-" + UUID.randomUUID()
            );
            fineractAccountId = savings.getResourceId();
        } catch (Exception e) {
            log.warn("Fineract unavailable — creating group without pooled savings account: {}", e.getMessage());
        }

        SaccoGroup.GroupType groupType = request.getGroupType() != null
            ? request.getGroupType() : SaccoGroup.GroupType.CHAMA;

        // SACCO groups require admin approval before going active
        SaccoGroup.GroupStatus initialStatus = groupType == SaccoGroup.GroupType.SACCO
            ? SaccoGroup.GroupStatus.PENDING_APPROVAL
            : SaccoGroup.GroupStatus.ACTIVE;

        SaccoGroup.SaccoGroupBuilder builder = SaccoGroup.builder()
            .name(request.getName())
            .description(request.getDescription())
            .monthlyContributionTarget(request.getMonthlyContributionTarget())
            .contributionDueDay(request.getContributionDueDay())
            .fineractGroupAccountId(fineractAccountId)
            .groupType(groupType)
            .status(initialStatus)
            .createdBy(creator);

        if (groupType == SaccoGroup.GroupType.SACCO) {
            builder.minContributionsRequired(request.getMinContributionsRequired());
            builder.minShares(request.getMinShares());
            builder.maxShares(request.getMaxShares());
            builder.loanMultiplier(request.getLoanMultiplier());
            if (request.getSharePrice() != null) builder.sharePrice(request.getSharePrice());
        }

        SaccoGroup group = builder.build();

        groupRepository.save(group);

        // Creator is automatically the first ADMIN
        GroupMember adminMembership = GroupMember.builder()
            .group(group)
            .member(creator)
            .role(GroupMember.GroupRole.ADMIN)
            .build();
        groupMemberRepository.save(adminMembership);

        log.info("Group created: id={} by userId={}", group.getId(), userId);
        return toResponse(group, creator);
    }

    @Transactional
    public void addMember(UUID groupId, UUID targetUserId, UUID requestingUserId) {
        SaccoGroup group = requireGroup(groupId);
        requireAdminRole(group, requestingUserId);

        Member targetMember = memberService.requireActiveByUserId(targetUserId);

        if (groupMemberRepository.existsByGroupAndMember(group, targetMember)) {
            throw new BankikoException("Member already in group", HttpStatus.CONFLICT);
        }

        GroupMember membership = GroupMember.builder()
            .group(group)
            .member(targetMember)
            .role(GroupMember.GroupRole.MEMBER)
            .build();
        groupMemberRepository.save(membership);
    }

    @Transactional(readOnly = true)
    public Page<GroupResponse> listForUser(UUID userId, Pageable pageable) {
        Member member = memberService.findByUserId(userId).orElse(null);
        return groupRepository.findGroupsByUserId(userId, pageable)
            .map(g -> toResponse(g, member));
    }

    @Transactional(readOnly = true)
    public GroupResponse get(UUID groupId, UUID userId) {
        SaccoGroup g = requireGroup(groupId);
        Member member = memberService.findByUserId(userId).orElse(null);
        return toResponse(g, member);
    }

    @Transactional
    public GroupResponse approveGroup(UUID groupId) {
        SaccoGroup group = requireGroup(groupId);
        if (group.getStatus() != SaccoGroup.GroupStatus.PENDING_APPROVAL) {
            throw new BankikoException("Group is not pending approval", HttpStatus.CONFLICT);
        }

        // Provision group treasury in Fineract if it wasn't created at group-creation time
        if (group.getFineractGroupAccountId() == null && group.getCreatedBy().getFineractClientId() != null) {
            try {
                FineractResponse savings = fineractClient.openSavingsAccount(
                    group.getCreatedBy().getFineractClientId(),
                    groupFundProductId,
                    "group-pool-" + group.getId()
                );
                group.setFineractGroupAccountId(savings.getResourceId());
                log.info("Group treasury provisioned at approval: groupId={} fineractAccountId={}", groupId, savings.getResourceId());
            } catch (Exception e) {
                log.warn("Could not provision Fineract group treasury on approval: {}", e.getMessage());
            }
        }

        group.setStatus(SaccoGroup.GroupStatus.ACTIVE);
        group.setApprovedAt(Instant.now());
        groupRepository.save(group);
        log.info("Group approved: id={}", groupId);
        return toResponse(group, null);
    }

    @Transactional
    public GroupResponse rejectGroup(UUID groupId, String reason) {
        SaccoGroup group = requireGroup(groupId);
        if (group.getStatus() != SaccoGroup.GroupStatus.PENDING_APPROVAL) {
            throw new BankikoException("Group is not pending approval", HttpStatus.CONFLICT);
        }
        group.setStatus(SaccoGroup.GroupStatus.CLOSED);
        group.setRejectedReason(reason);
        groupRepository.save(group);
        log.info("Group rejected: id={}", groupId);
        return toResponse(group, null);
    }

    @Transactional(readOnly = true)
    public java.util.List<GroupResponse> listPendingGroups() {
        return groupRepository.findByStatus(SaccoGroup.GroupStatus.PENDING_APPROVAL)
            .stream().map(g -> toResponse(g, null)).toList();
    }

    public SaccoGroup requireGroup(UUID groupId) {
        return groupRepository.findById(groupId)
            .orElseThrow(() -> new ResourceNotFoundException("Group", groupId));
    }

    public GroupMember requireMembership(SaccoGroup group, UUID userId) {
        Member member = memberService.requireActiveByUserId(userId);
        return groupMemberRepository.findByGroupAndMember(group, member)
            .orElseThrow(() -> new BankikoException("You are not a member of this group", HttpStatus.FORBIDDEN));
    }

    private void requireAdminRole(SaccoGroup group, UUID userId) {
        GroupMember membership = requireMembership(group, userId);
        if (membership.getRole() != GroupMember.GroupRole.ADMIN) {
            throw new BankikoException("Only group admins can perform this action", HttpStatus.FORBIDDEN);
        }
    }

    private GroupResponse toResponse(SaccoGroup g, Member member) {
        String role = null;
        if (member != null) {
            role = groupMemberRepository.findByGroupAndMember(g, member)
                .map(gm -> gm.getRole().name())
                .orElse(null);
        }
        return GroupResponse.builder()
            .id(g.getId().toString())
            .name(g.getName())
            .description(g.getDescription())
            .monthlyContributionTarget(g.getMonthlyContributionTarget())
            .contributionDueDay(g.getContributionDueDay())
            .fineractGroupAccountId(g.getFineractGroupAccountId())
            .groupType(g.getGroupType().name())
            .status(g.getStatus().name())
            .role(role)
            .memberCount(g.getMembers().size())
            .createdAt(g.getCreatedAt())
            .minContributionsRequired(g.getMinContributionsRequired())
            .sharePrice(g.getSharePrice())
            .minShares(g.getMinShares())
            .maxShares(g.getMaxShares())
            .loanMultiplier(g.getLoanMultiplier())
            .build();
    }
}
