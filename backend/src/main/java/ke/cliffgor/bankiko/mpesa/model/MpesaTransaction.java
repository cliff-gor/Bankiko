package ke.cliffgor.bankiko.mpesa.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import ke.cliffgor.bankiko.auth.model.User;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "mpesa_transactions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MpesaTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // MerchantRequestID from STK push response — used to match callbacks
    @Column(unique = true)
    private String merchantRequestId;

    // CheckoutRequestID from STK push response
    @Column(unique = true)
    private String checkoutRequestId;

    // MpesaReceiptNumber from successful callback — use as Fineract receipt
    private String mpesaReceiptNumber;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(nullable = false)
    private User user;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false)
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TransactionType type;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private TransactionStatus status = TransactionStatus.PENDING;

    // Optional: links this transaction to a group contribution
    private UUID groupId;

    private String failureReason;

    @Builder.Default
    private Instant createdAt = Instant.now();

    private Instant completedAt;

    @Version
    private Long version;

    public enum TransactionType {
        DEPOSIT,       // Member deposits into own wallet (STK push → C2B)
        CONTRIBUTION,  // Member contributes to group pool (STK push → C2B)
        WITHDRAWAL     // Admin/member withdraws to M-Pesa (B2C)
    }

    public enum TransactionStatus {
        PENDING,    // STK push sent, waiting for callback
        SUCCESS,    // Callback confirmed payment
        FAILED,     // Callback reported failure or STK push rejected
        TIMEOUT     // No callback received within expected window
    }
}
