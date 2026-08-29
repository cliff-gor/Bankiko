CREATE TABLE loans (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id),
    group_id         UUID NOT NULL,
    group_name       VARCHAR(255),
    principal        NUMERIC(15, 2) NOT NULL,
    repayment_months INT NOT NULL,
    status           VARCHAR(30) NOT NULL DEFAULT 'PENDING_APPROVAL',
    purpose          TEXT,
    fineract_loan_id BIGINT,
    applied_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    disbursed_at     TIMESTAMPTZ
);
