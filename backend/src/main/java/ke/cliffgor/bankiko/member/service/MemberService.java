package ke.cliffgor.bankiko.member.service;

import ke.cliffgor.bankiko.auth.model.User;
import ke.cliffgor.bankiko.auth.repository.UserRepository;
import ke.cliffgor.bankiko.common.exception.BankikoException;
import ke.cliffgor.bankiko.common.exception.ResourceNotFoundException;
import ke.cliffgor.bankiko.fineract.client.FineractClient;
import ke.cliffgor.bankiko.fineract.dto.FineractResponse;
import ke.cliffgor.bankiko.member.dto.MemberResponse;
import ke.cliffgor.bankiko.member.model.Member;
import ke.cliffgor.bankiko.member.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class MemberService {

    private final MemberRepository memberRepository;
    private final UserRepository userRepository;
    private final FineractClient fineractClient;

    // Fineract savings product ID for individual wallets — configure in application.yml
    @Value("${bankiko.fineract.wallet-product-id:1}")
    private int walletProductId;

    /**
     * Onboards a registered user into Fineract, creating a client record
     * and opening their individual savings (wallet) account.
     */
    @Transactional
    public MemberResponse onboard(UUID userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        if (memberRepository.findByUserId(userId).isPresent()) {
            throw new BankikoException("Member already onboarded", HttpStatus.CONFLICT);
        }

        Long fineractClientId = null;
        Long fineractSavingsAccountId = null;

        try {
            String[] names = splitName(user.getFullName());
            FineractResponse clientResponse = fineractClient.createClient(
                names[0], names[1], user.getPhone(), "user-" + userId
            );
            FineractResponse savingsResponse = fineractClient.openSavingsAccount(
                clientResponse.getResourceId(), walletProductId, "wallet-" + userId
            );
            fineractClientId = clientResponse.getResourceId();
            fineractSavingsAccountId = savingsResponse.getResourceId();
            log.info("Fineract onboarding complete: userId={} clientId={}", userId, fineractClientId);
        } catch (Exception e) {
            log.warn("Fineract unavailable during onboarding for userId={} — continuing without it: {}", userId, e.getMessage());
        }

        Member member = Member.builder()
            .user(user)
            .fineractClientId(fineractClientId)
            .fineractSavingsAccountId(fineractSavingsAccountId)
            .status(Member.MemberStatus.ACTIVE)
            .onboardedAt(Instant.now())
            .build();

        memberRepository.save(member);
        log.info("Member onboarded locally: userId={}", userId);

        return toResponse(member);
    }

    @Transactional(readOnly = true)
    public MemberResponse getByUserId(UUID userId) {
        return memberRepository.findByUserId(userId)
            .map(this::toResponse)
            .orElseThrow(() -> new ResourceNotFoundException("Member", userId));
    }

    public Optional<Member> findByUserId(UUID userId) {
        return memberRepository.findByUserId(userId);
    }

    public Member requireActiveByUserId(UUID userId) {
        Member member = memberRepository.findByUserId(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Member", userId));
        if (member.getStatus() != Member.MemberStatus.ACTIVE) {
            throw new BankikoException("Member account is not active", HttpStatus.FORBIDDEN);
        }
        return member;
    }

    private MemberResponse toResponse(Member m) {
        return MemberResponse.builder()
            .id(m.getId().toString())
            .userId(m.getUser().getId().toString())
            .fullName(m.getUser().getFullName())
            .phone(m.getUser().getPhone())
            .fineractClientId(m.getFineractClientId())
            .fineractSavingsAccountId(m.getFineractSavingsAccountId())
            .status(m.getStatus().name())
            .onboardedAt(m.getOnboardedAt())
            .build();
    }

    private String[] splitName(String fullName) {
        int space = fullName.indexOf(' ');
        if (space == -1) return new String[]{fullName, ""};
        return new String[]{fullName.substring(0, space), fullName.substring(space + 1)};
    }
}
