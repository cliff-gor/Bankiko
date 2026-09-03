package ke.cliffgor.bankiko.report.controller;

import ke.cliffgor.bankiko.auth.model.User;
import ke.cliffgor.bankiko.report.service.PdfStatementService;
import ke.cliffgor.bankiko.report.service.SasraReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final PdfStatementService pdfStatementService;
    private final SasraReportService sasraReportService;

    /** Download the authenticated member's full statement as PDF */
    @GetMapping("/statement/me")
    public ResponseEntity<byte[]> myStatement(@AuthenticationPrincipal User user) {
        byte[] pdf = pdfStatementService.generateMemberStatement(user);
        return pdf(pdf, "statement-" + user.getId().toString().substring(0, 8) + ".pdf");
    }

    /**
     * Admin: SASRA monthly returns PDF for a group.
     * Defaults to current month/year if not specified.
     */
    @GetMapping("/sasra/groups/{groupId}/monthly")
    public ResponseEntity<byte[]> monthlyReturns(
        @PathVariable UUID groupId,
        @RequestParam(required = false) Integer year,
        @RequestParam(required = false) Integer month
    ) {
        LocalDate now = LocalDate.now();
        byte[] pdf = sasraReportService.monthlyReturns(
            groupId,
            year != null ? year : now.getYear(),
            month != null ? month : now.getMonthValue()
        );
        return pdf(pdf, "sasra-monthly-" + groupId.toString().substring(0, 8) + ".pdf");
    }

    private ResponseEntity<byte[]> pdf(byte[] content, String filename) {
        return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_PDF)
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
            .body(content);
    }
}
