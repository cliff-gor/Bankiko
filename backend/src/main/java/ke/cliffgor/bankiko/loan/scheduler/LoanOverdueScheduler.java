package ke.cliffgor.bankiko.loan.scheduler;

import ke.cliffgor.bankiko.group.model.SaccoGroup;
import ke.cliffgor.bankiko.group.service.GroupService;
import ke.cliffgor.bankiko.loan.model.LoanRepayment;
import ke.cliffgor.bankiko.loan.repository.LoanRepaymentRepository;
import ke.cliffgor.bankiko.notification.service.PushNotificationService;
import ke.cliffgor.bankiko.notification.service.SmsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class LoanOverdueScheduler {

    private final LoanRepaymentRepository repaymentRepository;
    private final GroupService groupService;
    private final SmsService smsService;
    private final PushNotificationService pushService;

    /** Runs every day at 08:00 EAT (05:00 UTC) */
    @Scheduled(cron = "0 0 5 * * *", zone = "UTC")
    @Transactional
    public void markOverdueInstallments() {
        LocalDate today = LocalDate.now();
        List<LoanRepayment> overdue = repaymentRepository.findPendingDueBefore(today);

        if (overdue.isEmpty()) return;

        for (LoanRepayment inst : overdue) {
            inst.setStatus(LoanRepayment.RepaymentStatus.OVERDUE);

            // Calculate penalty = latePenaltyRate% of the installment amount
            try {
                SaccoGroup group = groupService.requireGroup(inst.getLoan().getGroupId());
                if (group.getLatePenaltyRate() != null && group.getLatePenaltyRate().compareTo(BigDecimal.ZERO) > 0) {
                    BigDecimal penalty = inst.getAmountDue()
                        .multiply(group.getLatePenaltyRate())
                        .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                    inst.setPenaltyAmount(penalty);
                }
            } catch (Exception e) {
                log.warn("Could not compute penalty for installment={}: {}", inst.getId(), e.getMessage());
            }

            repaymentRepository.save(inst);

            try {
                String msg = "Bankiko: Loan installment #" + inst.getInstallmentNo() +
                    " of KES " + inst.getAmountDue() + " was due on " + inst.getDueDate() +
                    " and is now OVERDUE. Please repay to avoid penalties.";
                smsService.send(inst.getLoan().getUser().getPhone(), msg);
                pushService.sendToUser(inst.getLoan().getUser(),
                    "Loan Overdue",
                    "Installment #" + inst.getInstallmentNo() + " (KES " + inst.getAmountDue() + ") is overdue.");
            } catch (Exception e) {
                log.warn("Failed to notify overdue installment id={}: {}", inst.getId(), e.getMessage());
            }
        }

        log.info("Marked {} installments as OVERDUE", overdue.size());
    }
}
