-- ============================================================
-- V1 — Core schema: users, auth, members, groups, contributions
-- ============================================================

-- Users (authentication)
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    phone           VARCHAR(20)  NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(50)  NOT NULL DEFAULT 'MEMBER',
    enabled         BOOLEAN      NOT NULL DEFAULT TRUE,
    fineract_client_id BIGINT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);

-- Refresh tokens (stored server-side for revocation capability)
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token       VARCHAR(255) NOT NULL UNIQUE,
    user_id     UUID         NOT NULL REFERENCES users(id),
    expires_at  TIMESTAMPTZ  NOT NULL,
    revoked     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_user  ON refresh_tokens(user_id);

-- Members (links a user to their Fineract client + savings account)
CREATE TABLE members (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     UUID        NOT NULL UNIQUE REFERENCES users(id),
    fineract_client_id          BIGINT,
    fineract_savings_account_id BIGINT,
    status                      VARCHAR(50) NOT NULL DEFAULT 'PENDING_ONBOARDING',
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    onboarded_at                TIMESTAMPTZ
);

CREATE INDEX idx_members_user ON members(user_id);

-- SACCO groups
CREATE TABLE sacco_groups (
    id                          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    name                        VARCHAR(255)   NOT NULL,
    description                 TEXT,
    fineract_group_account_id   BIGINT,
    monthly_contribution_target NUMERIC(15,2)  NOT NULL DEFAULT 0,
    contribution_due_day        INT            NOT NULL DEFAULT 5,
    status                      VARCHAR(50)    NOT NULL DEFAULT 'ACTIVE',
    created_by_id               UUID           NOT NULL REFERENCES members(id),
    created_at                  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Group memberships
CREATE TABLE group_members (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id    UUID        NOT NULL REFERENCES sacco_groups(id),
    member_id   UUID        NOT NULL REFERENCES members(id),
    role        VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_group_member UNIQUE (group_id, member_id)
);

CREATE INDEX idx_group_members_group  ON group_members(group_id);
CREATE INDEX idx_group_members_member ON group_members(member_id);

-- Contributions (one per member per group per month)
CREATE TABLE contributions (
    id                   UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id            UUID           NOT NULL REFERENCES members(id),
    group_id             UUID           NOT NULL REFERENCES sacco_groups(id),
    amount               NUMERIC(15,2)  NOT NULL,
    contribution_month   VARCHAR(7)     NOT NULL,   -- YYYY-MM
    mpesa_receipt_number VARCHAR(100),
    paid_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_contribution_month UNIQUE (member_id, group_id, contribution_month)
);

CREATE INDEX idx_contributions_group  ON contributions(group_id);
CREATE INDEX idx_contributions_member ON contributions(member_id);

-- M-Pesa transactions
CREATE TABLE mpesa_transactions (
    id                   UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_request_id  VARCHAR(100)   UNIQUE,
    checkout_request_id  VARCHAR(100)   UNIQUE,
    mpesa_receipt_number VARCHAR(100),
    user_id              UUID           NOT NULL REFERENCES users(id),
    amount               NUMERIC(15,2)  NOT NULL,
    phone                VARCHAR(20)    NOT NULL,
    type                 VARCHAR(50)    NOT NULL,
    status               VARCHAR(50)    NOT NULL DEFAULT 'PENDING',
    group_id             UUID,
    failure_reason       TEXT,
    created_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    completed_at         TIMESTAMPTZ,
    version              BIGINT         NOT NULL DEFAULT 0
);

CREATE INDEX idx_mpesa_checkout ON mpesa_transactions(checkout_request_id);
CREATE INDEX idx_mpesa_user     ON mpesa_transactions(user_id);

-- Transactional outbox (reliable downstream calls)
CREATE TABLE outbox_events (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type    VARCHAR(100) NOT NULL,
    payload       TEXT         NOT NULL,
    status        VARCHAR(50)  NOT NULL DEFAULT 'PENDING',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    processed_at  TIMESTAMPTZ,
    error_message TEXT,
    version       BIGINT       NOT NULL DEFAULT 0
);

CREATE INDEX idx_outbox_status ON outbox_events(status);
