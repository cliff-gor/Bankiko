package ke.cliffgor.bankiko.auth.service;

import ke.cliffgor.bankiko.auth.dto.AuthResponse;
import ke.cliffgor.bankiko.auth.dto.LoginRequest;
import ke.cliffgor.bankiko.auth.dto.RefreshRequest;
import ke.cliffgor.bankiko.auth.dto.RegisterRequest;
import ke.cliffgor.bankiko.auth.model.RefreshToken;
import ke.cliffgor.bankiko.auth.model.User;
import ke.cliffgor.bankiko.auth.repository.RefreshTokenRepository;
import ke.cliffgor.bankiko.auth.repository.UserRepository;
import ke.cliffgor.bankiko.common.config.BankikoProperties;
import ke.cliffgor.bankiko.common.exception.BankikoException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final BankikoProperties properties;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BankikoException("Email already registered", HttpStatus.CONFLICT);
        }
        if (userRepository.existsByPhone(request.getPhone())) {
            throw new BankikoException("Phone already registered", HttpStatus.CONFLICT);
        }

        User user = User.builder()
            .fullName(request.getFullName())
            .email(request.getEmail())
            .phone(request.getPhone())
            .passwordHash(passwordEncoder.encode(request.getPassword()))
            .role(User.Role.MEMBER)
            .build();

        userRepository.save(user);
        return buildTokenPair(user);
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );

        User user = userRepository.findByEmail(request.getEmail())
            .orElseThrow(() -> new BankikoException("User not found", HttpStatus.NOT_FOUND));

        // Revoke existing refresh tokens before issuing a new one
        refreshTokenRepository.revokeAllForUser(user);
        return buildTokenPair(user);
    }

    @Transactional
    public AuthResponse refresh(RefreshRequest request) {
        RefreshToken stored = refreshTokenRepository.findByToken(request.getRefreshToken())
            .orElseThrow(() -> new BankikoException("Invalid refresh token", HttpStatus.UNAUTHORIZED));

        if (stored.isRevoked()) {
            throw new BankikoException("Refresh token revoked", HttpStatus.UNAUTHORIZED);
        }
        if (stored.getExpiresAt().isBefore(Instant.now())) {
            throw new BankikoException("Refresh token expired", HttpStatus.UNAUTHORIZED);
        }

        stored.setRevoked(true);
        refreshTokenRepository.save(stored);

        return buildTokenPair(stored.getUser());
    }

    @Transactional
    public void logout(String refreshToken) {
        refreshTokenRepository.findByToken(refreshToken)
            .ifPresent(t -> {
                t.setRevoked(true);
                refreshTokenRepository.save(t);
            });
    }

    private AuthResponse buildTokenPair(User user) {
        String accessToken = jwtService.generateAccessToken(user);
        String rawRefresh = UUID.randomUUID().toString();

        int refreshDays = properties.getJwt().getRefreshExpiryDays();
        RefreshToken refreshToken = RefreshToken.builder()
            .token(rawRefresh)
            .user(user)
            .expiresAt(Instant.now().plus(refreshDays, ChronoUnit.DAYS))
            .build();

        refreshTokenRepository.save(refreshToken);

        return AuthResponse.builder()
            .accessToken(accessToken)
            .refreshToken(rawRefresh)
            .tokenType("Bearer")
            .expiresIn(properties.getJwt().getAccessExpiryMinutes() * 60L)
            .userId(user.getId().toString())
            .fullName(user.getFullName())
            .role(user.getRole().name())
            .build();
    }
}
