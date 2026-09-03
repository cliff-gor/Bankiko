CREATE TABLE IF NOT EXISTS loan_repayments (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id         UUID        NOT NULL REFERENCES loans(id),
    installment_no  INT         NOT NULL,
    due_date        DATE        NOT NULL,
    amount_due      NUMERIC(15,2) NOT NULL,
    amount_paid     NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    paid_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loan_repayments_loan ON loan_repayments(loan_id);
