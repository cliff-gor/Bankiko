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
import ke.cliffgor.bankiko.contribution.repository.ContributionRepository;
import ke.cliffgor.bankiko.group.model.SaccoGroup;
import ke.cliffgor.bankiko.group.repository.SaccoGroupRepository;
import ke.cliffgor.bankiko.loan.repository.LoanRepository;
import ke.cliffgor.bankiko.member.repository.MemberRepository;
import ke.cliffgor.bankiko.share.repository.ShareHoldingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

/**
 * Generates SASRA-style regulatory reports:
 *  - Monthly returns: contributions collected, loans disbursed/outstanding
 *  - Capital adequacy snapshot: total share capital vs outstanding loans
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SasraReportService {

    private final SaccoGroupRepository groupRepository;
    private final MemberRepository memberRepository;
    private final ContributionRepository contributionRepository;
    private final LoanRepository loanRepository;
    private final ShareHoldingRepository shareHoldingRepository;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy");
    private static final DateTimeFormatter MONTH_FMT = DateTimeFormatter.ofPattern("MMMM yyyy");

    @Transactional(readOnly = true)
    public byte[] monthlyReturns(UUID groupId, int year, int month) {
        SaccoGroup group = groupRepository.findById(groupId)
            .orElseThrow(() -> new IllegalArgumentException("Group not found"));

        YearMonth ym = YearMonth.of(year, month);
        String ymStr = ym.toString(); // e.g. 2026-09

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        PdfDocument pdf = new PdfDocument(new PdfWriter(out));
        Document doc = new Document(pdf);

        // Title
        doc.add(new Paragraph("BANKIKO SACCO — Monthly Returns").setBold().setFontSize(16).setTextAlignment(TextAlignment.CENTER));
        doc.add(new Paragraph("Group: " + group.getName()).setTextAlignment(TextAlignment.CENTER));
        doc.add(new Paragraph("Period: " + ym.format(MONTH_FMT)).setTextAlignment(TextAlignment.CENTER));
        doc.add(new Paragraph("Report Date: " + LocalDate.now().format(DATE_FMT)).setFontSize(9).setTextAlignment(TextAlignment.CENTER).setMarginBottom(16));

        // Membership
        long totalMembers = memberRepository.count();
        doc.add(sectionHeader("1. Membership"));
        Table m = table(new float[]{4, 2});
        m.addCell("Total Active Members"); m.addCell(String.valueOf(totalMembers));
        doc.add(m.setMarginBottom(12));

        // Contributions for the month
        var contributions = contributionRepository.findAll().stream()
            .filter(c -> ymStr.equals(c.getContributionMonth()) && c.getGroup().getId().equals(groupId))
            .toList();
        BigDecimal totalContributions = contributions.stream()
            .map(ke.cliffgor.bankiko.contribution.model.Contribution::getAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        doc.add(sectionHeader("2. Contributions"));
        Table ct = table(new float[]{4, 2});
        ct.addCell("Members Who Contributed"); ct.addCell(String.valueOf(contributions.size()));
        ct.addCell("Total Amount Collected (KES)"); ct.addCell(totalContributions.toPlainString());
        doc.add(ct.setMarginBottom(12));

        // Loans
        var allLoans = loanRepository.findAll().stream()
            .filter(l -> l.getGroupId().equals(groupId)).toList();
        var activeLoans = allLoans.stream().filter(l -> "ACTIVE".equals(l.getStatus())).toList();
        BigDecimal totalDisbursed = allLoans.stream()
            .filter(l -> "ACTIVE".equals(l.getStatus()) || "CLOSED".equals(l.getStatus()))
            .map(ke.cliffgor.bankiko.loan.model.Loan::getPrincipal)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalOutstanding = activeLoans.stream()
            .map(l -> l.getOutstandingBalance() != null ? l.getOutstandingBalance() : l.getPrincipal())
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalInterestIncome = allLoans.stream()
            .filter(l -> "CLOSED".equals(l.getStatus()))
            .map(l -> l.getTotalInterest() != null ? l.getTotalInterest() : BigDecimal.ZERO)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        doc.add(sectionHeader("3. Loan Portfolio"));
        Table lt = table(new float[]{4, 2});
        lt.addCell("Total Loans (active)"); lt.addCell(String.valueOf(activeLoans.size()));
        lt.addCell("Total Disbursed (KES)"); lt.addCell(totalDisbursed.toPlainString());
        lt.addCell("Outstanding Loan Book (KES)"); lt.addCell(totalOutstanding.toPlainString());
        lt.addCell("Interest Income (closed loans, KES)"); lt.addCell(totalInterestIncome.toPlainString());
        doc.add(lt.setMarginBottom(12));

        // Share Capital
        var holdings = shareHoldingRepository.findByGroupIdOrderBySharesHeldDesc(groupId);
        int totalShares = holdings.stream().mapToInt(h -> h.getSharesHeld()).sum();
        BigDecimal totalShareCapital = holdings.stream()
            .map(h -> group.getSharePrice().multiply(BigDecimal.valueOf(h.getSharesHeld())))
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        doc.add(sectionHeader("4. Capital Adequacy"));
        BigDecimal ratio = totalShareCapital.compareTo(BigDecimal.ZERO) > 0
            ? totalOutstanding.divide(totalShareCapital, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100))
            : BigDecimal.ZERO;

        Table cap = table(new float[]{4, 2});
        cap.addCell("Total Share Capital (KES)"); cap.addCell(totalShareCapital.toPlainString());
        cap.addCell("Total Shares Issued"); cap.addCell(String.valueOf(totalShares));
        cap.addCell("Outstanding Loans / Share Capital (%)"); cap.addCell(ratio.toPlainString() + "%");
        cap.addCell("SASRA Recommended Max (%)"); cap.addCell("300%");
        doc.add(cap.setMarginBottom(12));

        doc.add(new Paragraph("\nCertified correct by Bankiko SACCO Management System.")
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
}
