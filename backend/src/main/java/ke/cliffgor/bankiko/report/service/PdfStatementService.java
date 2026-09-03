package ke.cliffgor.bankiko.report.service;

import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import ke.cliffgor.bankiko.auth.model.User;
import ke.cliffgor.bankiko.contribution.repository.ContributionRepository;
import ke.cliffgor.bankiko.loan.model.LoanRepayment;
import ke.cliffgor.bankiko.loan.repository.LoanRepaymentRepository;
import ke.cliffgor.bankiko.loan.repository.LoanRepository;
import ke.cliffgor.bankiko.member.model.Member;
import ke.cliffgor.bankiko.member.service.MemberService;
import ke.cliffgor.bankiko.mpesa.repository.MpesaTransactionRepository;
import ke.cliffgor.bankiko.share.repository.ShareHoldingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

@Slf4j
@Service
@RequiredArgsConstructor
public class PdfStatementService {

    private final MemberService memberService;
    private final MpesaTransactionRepository txRepository;
    private final LoanRepository loanRepository;
    private final LoanRepaymentRepository repaymentRepository;
    private final ContributionRepository contributionRepository;
    private final ShareHoldingRepository shareHoldingRepository;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy");

    @Transactional(readOnly = true)
    public byte[] generateMemberStatement(User user) {
        Member member = memberService.requireActiveByUserId(user.getId());

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        PdfWriter writer = new PdfWriter(out);
        PdfDocument pdf = new PdfDocument(writer);
        Document doc = new Document(pdf);

        // Header
        doc.add(new Paragraph("BANKIKO SACCO")
            .setBold().setFontSize(18).setTextAlignment(TextAlignment.CENTER));
        doc.add(new Paragraph("Member Statement")
            .setFontSize(12).setTextAlignment(TextAlignment.CENTER));
        doc.add(new Paragraph("Generated: " + LocalDate.now().format(DATE_FMT))
            .setFontSize(9).setTextAlignment(TextAlignment.CENTER).setMarginBottom(10));

        // Member Info
        doc.add(new Paragraph("Member: " + member.getUser().getFullName()).setBold());
        doc.add(new Paragraph("Phone:  " + member.getUser().getPhone()));
        doc.add(new Paragraph("Email:  " + member.getUser().getEmail()).setMarginBottom(12));

        // --- Share Holdings ---
        doc.add(sectionHeader("Share Holdings"));
        var holdings = shareHoldingRepository.findByMemberId(member.getId());
        if (holdings.isEmpty()) {
            doc.add(new Paragraph("No share holdings.").setItalic().setMarginBottom(8));
        } else {
            Table t = table(new float[]{4, 1, 2, 2});
            headerRow(t, "Group", "Shares", "Total Invested (KES)", "Max Loan (KES)");
            for (var h : holdings) {
                t.addCell(h.getGroup().getName());
                t.addCell(String.valueOf(h.getSharesHeld()));
                t.addCell(h.getTotalInvested().toPlainString());
                var ml = h.getGroup().getSharePrice()
                    .multiply(java.math.BigDecimal.valueOf(h.getSharesHeld()))
                    .multiply(java.math.BigDecimal.valueOf(h.getGroup().getLoanMultiplier()));
                t.addCell(ml.toPlainString());
            }
            doc.add(t.setMarginBottom(12));
        }

        // --- Active Loans ---
        doc.add(sectionHeader("Loans"));
        var loans = loanRepository.findByUserIdOrderByAppliedAtDesc(user.getId());
        if (loans.isEmpty()) {
            doc.add(new Paragraph("No loans.").setItalic().setMarginBottom(8));
        } else {
            Table t = table(new float[]{3, 2, 2, 2, 2, 1});
            headerRow(t, "Group", "Principal (KES)", "Outstanding (KES)", "Total Interest", "Status", "Months");
            for (var loan : loans) {
                t.addCell(loan.getGroupName());
                t.addCell(loan.getPrincipal().toPlainString());
                t.addCell(loan.getOutstandingBalance() != null ? loan.getOutstandingBalance().toPlainString() : "-");
                t.addCell(loan.getTotalInterest() != null ? loan.getTotalInterest().toPlainString() : "-");
                t.addCell(loan.getStatus());
                t.addCell(String.valueOf(loan.getRepaymentMonths()));
            }
            doc.add(t.setMarginBottom(12));
        }

        // --- Contribution History ---
        doc.add(sectionHeader("Contribution History"));
        var contribs = contributionRepository.findByMemberOrderByPaidAtDesc(member);
        if (contribs.isEmpty()) {
            doc.add(new Paragraph("No contributions recorded.").setItalic().setMarginBottom(8));
        } else {
            Table t = table(new float[]{3, 2, 2, 2});
            headerRow(t, "Group", "Month", "Amount (KES)", "Receipt");
            for (var c : contribs) {
                t.addCell(c.getGroup().getName());
                t.addCell(c.getContributionMonth());
                t.addCell(c.getAmount().toPlainString());
                t.addCell(c.getMpesaReceiptNumber() != null ? c.getMpesaReceiptNumber() : "-");
            }
            doc.add(t.setMarginBottom(12));
        }

        // --- Repayment Schedule (active loans) ---
        var activeLoans = loans.stream().filter(l -> "ACTIVE".equals(l.getStatus())).toList();
        if (!activeLoans.isEmpty()) {
            doc.add(sectionHeader("Repayment Schedule (Active Loans)"));
            for (var loan : activeLoans) {
                doc.add(new Paragraph(loan.getGroupName() + " — KES " + loan.getPrincipal())
                    .setBold().setFontSize(9));
                var schedule = repaymentRepository.findByLoanIdOrderByInstallmentNo(loan.getId());
                Table t = table(new float[]{1, 2, 2, 2, 2});
                headerRow(t, "#", "Due Date", "Amount Due", "Paid", "Status");
                for (LoanRepayment r : schedule) {
                    t.addCell(String.valueOf(r.getInstallmentNo()));
                    t.addCell(r.getDueDate().format(DATE_FMT));
                    t.addCell(r.getAmountDue().toPlainString());
                    t.addCell(r.getAmountPaid().toPlainString());
                    Cell statusCell = new Cell().add(new Paragraph(r.getStatus().name()));
                    if (r.getStatus() == LoanRepayment.RepaymentStatus.OVERDUE) {
                        statusCell.setFontColor(ColorConstants.RED);
                    } else if (r.getStatus() == LoanRepayment.RepaymentStatus.PAID) {
                        statusCell.setFontColor(ColorConstants.DARK_GRAY);
                    }
                    t.addCell(statusCell);
                }
                doc.add(t.setMarginBottom(8));
            }
        }

        doc.add(new Paragraph("\nThis statement is generated by Bankiko SACCO platform.")
            .setFontSize(8).setItalic().setTextAlignment(TextAlignment.CENTER));

        doc.close();
        return out.toByteArray();
    }

    private Paragraph sectionHeader(String title) {
        return new Paragraph(title).setBold().setFontSize(11)
            .setBackgroundColor(ColorConstants.LIGHT_GRAY).setMarginBottom(4);
    }

    private Table table(float[] widths) {
        return new Table(UnitValue.createPercentArray(widths)).useAllAvailableWidth().setFontSize(9);
    }

    private void headerRow(Table t, String... headers) {
        for (String h : headers) {
            t.addHeaderCell(new Cell().add(new Paragraph(h).setBold())
                .setBackgroundColor(ColorConstants.LIGHT_GRAY));
        }
    }
}
