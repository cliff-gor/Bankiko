package ke.cliffgor.bankiko.admin;

import ke.cliffgor.bankiko.auth.model.User;
import ke.cliffgor.bankiko.auth.model.User.Role;
import ke.cliffgor.bankiko.auth.repository.UserRepository;
import ke.cliffgor.bankiko.common.exception.BankikoException;
import ke.cliffgor.bankiko.group.model.GroupMember;
import ke.cliffgor.bankiko.group.model.SaccoGroup;
import ke.cliffgor.bankiko.group.repository.GroupMemberRepository;
import ke.cliffgor.bankiko.group.repository.SaccoGroupRepository;
import ke.cliffgor.bankiko.group.service.GroupService;
import ke.cliffgor.bankiko.member.model.Member;
import ke.cliffgor.bankiko.loan.model.Loan;
import ke.cliffgor.bankiko.loan.repository.LoanRepository;
import ke.cliffgor.bankiko.member.repository.MemberRepository;
import ke.cliffgor.bankiko.mpesa.model.MpesaTransaction;
import ke.cliffgor.bankiko.mpesa.repository.MpesaTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('SYSTEM_ADMIN')")
@RequiredArgsConstructor
public class AdminController {

    private final UserRepository userRepository;
    private final SaccoGroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final MemberRepository memberRepository;
    private final LoanRepository loanRepository;
    private final MpesaTransactionRepository transactionRepository;
    private final GroupService groupService;

    @GetMapping("/users")
    public ResponseEntity<Page<UserSummary>> listUsers(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        Page<UserSummary> result = userRepository
            .findAll(PageRequest.of(page, size, Sort.by("createdAt").descending()))
            .map(this::toSummary);
        return ResponseEntity.ok(result);
    }

    @PutMapping("/users/{userId}/enable")
    public ResponseEntity<Void> enable(@PathVariable UUID userId) {
        userRepository.findById(userId).ifPresent(u -> {
            u.setEnabled(true);
            userRepository.save(u);
        });
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/users/{userId}/disable")
    public ResponseEntity<Void> disable(@PathVariable UUID userId) {
        userRepository.findById(userId).ifPresent(u -> {
            u.setEnabled(false);
            userRepository.save(u);
        });
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/users/{userId}/role")
    public ResponseEntity<Void> setRole(@PathVariable UUID userId, @RequestBody RoleRequest req) {
        userRepository.findById(userId).ifPresent(u -> {
            u.setRole(Role.valueOf(req.role()));
            userRepository.save(u);
        });
        return ResponseEntity.noContent().build();
    }

    @Transactional(readOnly = true)
    @GetMapping("/groups")
    public ResponseEntity<java.util.List<GroupSummary>> listGroups() {
        return ResponseEntity.ok(groupRepository.findAll(Sort.by("createdAt").descending()).stream()
            .map(g -> new GroupSummary(g.getId(), g.getName(), g.getDescription(),
                g.getMonthlyContributionTarget(), g.getGroupType().name(), g.getStatus().name(), g.getMembers().size()))
            .toList());
    }

    @GetMapping("/groups/pending")
    public ResponseEntity<java.util.List<GroupSummary>> listPendingGroups() {
        return ResponseEntity.ok(groupService.listPendingGroups().stream()
            .map(g -> new GroupSummary(UUID.fromString(g.getId()), g.getName(), g.getDescription(),
                g.getMonthlyContributionTarget(), g.getGroupType(), g.getStatus(), g.getMemberCount()))
            .toList());
    }


    @PostMapping("/groups/{groupId}/approve")
    public ResponseEntity<Void> approveGroup(@PathVariable UUID groupId) {
        groupService.approveGroup(groupId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/groups/{groupId}/reject")
    public ResponseEntity<Void> rejectGroup(@PathVariable UUID groupId, @RequestParam(required = false) String reason) {
        groupService.rejectGroup(groupId, reason);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/transactions")
    public ResponseEntity<Page<MpesaTransaction>> listAllTransactions(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "30") int size
    ) {
        return ResponseEntity.ok(
            transactionRepository.findAll(PageRequest.of(page, size, Sort.by("createdAt").descending()))
        );
    }

    @Transactional(readOnly = true)
    @GetMapping("/loans")
    public ResponseEntity<java.util.List<LoanSummary>> listAllLoans() {
        return ResponseEntity.ok(loanRepository.findAll(Sort.by("appliedAt").descending()).stream()
            .map(l -> new LoanSummary(l.getId(), l.getUser().getId(), l.getUser().getFullName(),
                l.getGroupName(), l.getPrincipal(), l.getRepaymentMonths(), l.getStatus(),
                l.getPurpose(), l.getOutstandingBalance(), l.getTotalInterest(),
                l.getAppliedAt(), l.getDisbursedAt()))
            .toList());
    }

    @PostMapping("/groups/{groupId}/members/{userId}")
    public ResponseEntity<Void> addMemberToGroup(
        @PathVariable UUID groupId,
        @PathVariable UUID userId
    ) {
        SaccoGroup group = groupRepository.findById(groupId)
            .orElseThrow(() -> new BankikoException("Group not found", HttpStatus.NOT_FOUND));
        Member member = memberRepository.findByUserId(userId)
            .orElseThrow(() -> new BankikoException("Member profile not found for user", HttpStatus.NOT_FOUND));
        if (!groupMemberRepository.existsByGroupAndMember(group, member)) {
            groupMemberRepository.save(GroupMember.builder()
                .group(group).member(member).role(GroupMember.GroupRole.MEMBER).build());
        }
        return ResponseEntity.noContent().build();
    }

    public record GroupSummary(UUID id, String name, String description,
                               java.math.BigDecimal monthlyContributionTarget,
                               String groupType, String status, int memberCount) {}
    public record LoanSummary(UUID id, UUID userId, String memberName, String groupName,
                              java.math.BigDecimal principal, int repaymentMonths,
                              String status, String purpose,
                              java.math.BigDecimal outstandingBalance,
                              java.math.BigDecimal totalInterest,
                              Instant appliedAt, Instant disbursedAt) {}
    public record UserSummary(UUID id, String fullName, String email, String phone,
                              String role, boolean enabled, Instant createdAt) {}

    public record RoleRequest(String role) {}

    private UserSummary toSummary(User u) {
        return new UserSummary(u.getId(), u.getFullName(), u.getEmail(), u.getPhone(),
                u.getRole().name(), u.isEnabled(), u.getCreatedAt());
    }
}
