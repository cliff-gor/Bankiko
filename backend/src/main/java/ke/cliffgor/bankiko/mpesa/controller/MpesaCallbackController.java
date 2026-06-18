package ke.cliffgor.bankiko.mpesa.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import ke.cliffgor.bankiko.mpesa.dto.StkCallback;
import ke.cliffgor.bankiko.mpesa.model.MpesaTransaction;
import ke.cliffgor.bankiko.mpesa.repository.MpesaTransactionRepository;
import ke.cliffgor.bankiko.mpesa.service.StkPushService;
import ke.cliffgor.bankiko.wallet.service.WalletService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Receives callbacks from Safaricom Daraja. These endpoints are public — no auth header comes from Safaricom.
 * Idempotency is guaranteed by the unique checkoutRequestId on MpesaTransaction.
 */
@Tag(name = "M-Pesa Callbacks")
@Slf4j
@RestController
@RequestMapping("/api/mpesa/callback")
@RequiredArgsConstructor
public class MpesaCallbackController {

    private final StkPushService stkPushService;
    private final WalletService walletService;
    private final MpesaTransactionRepository transactionRepository;

    @Operation(summary = "STK push result callback from Safaricom")
    @PostMapping("/stk")
    @Transactional
    public ResponseEntity<Map<String, String>> stkCallback(@RequestBody StkCallback callback) {
        log.info("Received STK callback: success={}", callback.isSuccess());

        // Update transaction status first
        stkPushService.handleCallback(callback);

        // Credit Fineract only on confirmed payment
        if (callback.isSuccess() && callback.getData() != null) {
            String checkoutId = callback.getData().getCheckoutRequestId();
            transactionRepository.findByCheckoutRequestId(checkoutId)
                .ifPresent(walletService::processMpesaPayment);
        }

        // Daraja expects a 200 with this exact structure; any non-200 triggers a retry
        return ResponseEntity.ok(Map.of("ResultCode", "0", "ResultDesc", "Success"));
    }

    @Operation(summary = "B2C result callback from Safaricom")
    @PostMapping("/b2c")
    public ResponseEntity<Map<String, String>> b2cCallback(@RequestBody Map<String, Object> payload) {
        log.info("Received B2C callback: {}", payload);
        // B2C result handling — update payout status
        return ResponseEntity.ok(Map.of("ResultCode", "0", "ResultDesc", "Success"));
    }

    @Operation(summary = "B2C queue timeout callback")
    @PostMapping("/b2c/timeout")
    public ResponseEntity<Map<String, String>> b2cTimeout(@RequestBody Map<String, Object> payload) {
        log.warn("B2C timeout callback received: {}", payload);
        return ResponseEntity.ok(Map.of("ResultCode", "0", "ResultDesc", "Success"));
    }
}
