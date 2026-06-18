package ke.cliffgor.bankiko.mpesa.repository;

import ke.cliffgor.bankiko.mpesa.model.MpesaTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface MpesaTransactionRepository extends JpaRepository<MpesaTransaction, UUID> {

    Optional<MpesaTransaction> findByCheckoutRequestId(String checkoutRequestId);

    Optional<MpesaTransaction> findByMerchantRequestId(String merchantRequestId);

    Page<MpesaTransaction> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);
}
