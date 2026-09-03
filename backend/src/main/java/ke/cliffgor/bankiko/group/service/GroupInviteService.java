package ke.cliffgor.bankiko.group.service;

import ke.cliffgor.bankiko.auth.model.User;
import ke.cliffgor.bankiko.common.exception.BankikoException;
import org.springframework.http.HttpStatus;
import ke.cliffgor.bankiko.group.dto.InviteResponse;
import ke.cliffgor.bankiko.group.model.GroupInvite;
import ke.cliffgor.bankiko.group.model.GroupMember;
import ke.cliffgor.bankiko.group.model.GroupMember.GroupRole;
import ke.cliffgor.bankiko.group.model.SaccoGroup;
import ke.cliffgor.bankiko.group.repository.GroupInviteRepository;
import ke.cliffgor.bankiko.group.repository.GroupMemberRepository;
import ke.cliffgor.bankiko.group.repository.SaccoGroupRepository;
import ke.cliffgor.bankiko.member.model.Member;
import ke.cliffgor.bankiko.member.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class GroupInviteService {

    private final GroupInviteRepository inviteRepository;
    private final SaccoGroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final MemberRepository memberRepository;

    @Value("${bankiko.app-url:https://bankiko.app}")
    private String appUrl;

    private static final SecureRandom RANDOM = new SecureRandom();

    @Transactional
    public InviteResponse createInvite(UUID groupId, User admin, int ttlHours, Integer maxUses) {
        SaccoGroup group = groupRepository.findById(groupId)
            .orElseThrow(() -> new BankikoException("Group not found", HttpStatus.NOT_FOUND));

        // Only group admins or system admins can create invites
        boolean isSystemAdmin = admin.getRole().name().equals("SYSTEM_ADMIN");
        if (!isSystemAdmin) {
            Member member = memberRepository.findByUserId(admin.getId())
                .orElseThrow(() -> new BankikoException("Not a member", HttpStatus.FORBIDDEN));
            boolean isGroupAdmin = groupMemberRepository.findByGroup(group).stream()
                .anyMatch(gm -> gm.getMember().equals(member) && gm.getRole() == GroupRole.ADMIN);
            if (!isGroupAdmin) throw new BankikoException("Only group admins can create invites", HttpStatus.BAD_REQUEST);
        }

        byte[] bytes = new byte[36];
        RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        GroupInvite invite = new GroupInvite();
        invite.setGroup(group);
        invite.setToken(token);
        invite.setCreatedBy(admin);
        invite.setExpiresAt(LocalDateTime.now().plusHours(ttlHours));
        invite.setMaxUses(maxUses);
        inviteRepository.save(invite);

        log.info("Invite created for group {} by user {}", group.getName(), admin.getId());
        return toResponse(invite);
    }

    @Transactional(readOnly = true)
    public InviteResponse getInviteDetails(String token) {
        GroupInvite invite = findValid(token);
        return toResponse(invite);
    }

    @Transactional
    public InviteResponse joinViaInvite(String token, User user) {
        GroupInvite invite = findValid(token);
        SaccoGroup group = invite.getGroup();

        Member member = memberRepository.findByUserId(user.getId())
            .orElseThrow(() -> new BankikoException("Complete onboarding before joining a group", HttpStatus.FORBIDDEN));

        boolean alreadyMember = groupMemberRepository.findByGroup(group).stream()
            .anyMatch(gm -> gm.getMember().getId().equals(member.getId()));
        if (alreadyMember) throw new BankikoException("Already a member of this group", HttpStatus.BAD_REQUEST);

        GroupMember gm = GroupMember.builder()
            .group(group)
            .member(member)
            .role(GroupRole.MEMBER)
            .build();
        groupMemberRepository.save(gm);

        invite.setUseCount(invite.getUseCount() + 1);
        inviteRepository.save(invite);

        log.info("User {} joined group {} via invite", user.getId(), group.getName());
        return toResponse(invite);
    }

    private GroupInvite findValid(String token) {
        GroupInvite invite = inviteRepository.findByToken(token)
            .orElseThrow(() -> new BankikoException("Invite link is invalid", HttpStatus.NOT_FOUND));
        if (invite.isExpired())    throw new BankikoException("Invite link has expired", HttpStatus.BAD_REQUEST);
        if (invite.isExhausted()) throw new BankikoException("Invite link has reached its maximum uses", HttpStatus.BAD_REQUEST);
        return invite;
    }

    private InviteResponse toResponse(GroupInvite invite) {
        SaccoGroup g = invite.getGroup();
        String inviteUrl = appUrl + "/join/" + invite.getToken();
        return new InviteResponse(
            invite.getId(),
            invite.getToken(),
            g.getId().toString(),
            g.getName(),
            g.getGroupType() != null ? g.getGroupType().name() : "CHAMA",
            invite.getExpiresAt(),
            invite.getMaxUses(),
            invite.getUseCount(),
            inviteUrl
        );
    }
}
