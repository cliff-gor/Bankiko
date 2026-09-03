-- Loan interest configuration per group
ALTER TABLE sacco_groups
    ADD COLUMN IF NOT EXISTS annual_interest_rate  NUMERIC(5,2) NOT NULL DEFAULT 12.00,  -- % per year
    ADD COLUMN IF NOT EXISTS interest_type         VARCHAR(20)  NOT NULL DEFAULT 'REDUCING_BALANCE';
    -- interest_type: REDUCING_BALANCE | FLAT_RATE

-- Store interest fields on the loan itself (snapshot at origination)
ALTER TABLE loans
    ADD COLUMN IF NOT EXISTS interest_rate      NUMERIC(5,2),   -- annual %
    ADD COLUMN IF NOT EXISTS interest_type      VARCHAR(20),
    ADD COLUMN IF NOT EXISTS total_interest     NUMERIC(15,2),
    ADD COLUMN IF NOT EXISTS outstanding_balance NUMERIC(15,2);

-- Penalties config per group
ALTER TABLE sacco_groups
    ADD COLUMN IF NOT EXISTS late_penalty_rate     NUMERIC(5,2) NOT NULL DEFAULT 5.00,   -- % of installment
    ADD COLUMN IF NOT EXISTS contribution_penalty  NUMERIC(15,2) NOT NULL DEFAULT 0.00;  -- flat KES per missed month

-- Penalty tracking on overdue installments
ALTER TABLE loan_repayments
    ADD COLUMN IF NOT EXISTS penalty_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS penalty_paid   BOOLEAN NOT NULL DEFAULT FALSE;
