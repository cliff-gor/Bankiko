-- Share configuration per group (SACCO only, ignored for CHAMA)
ALTER TABLE sacco_groups
    ADD COLUMN IF NOT EXISTS share_price          NUMERIC(15,2) NOT NULL DEFAULT 200.00,
    ADD COLUMN IF NOT EXISTS min_shares           INT          NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS max_shares           INT          NOT NULL DEFAULT 1000,
    ADD COLUMN IF NOT EXISTS loan_multiplier      INT          NOT NULL DEFAULT 3;

-- One row per member per group — updated on every share purchase
CREATE TABLE IF NOT EXISTS share_holdings (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id      UUID        NOT NULL REFERENCES sacco_groups(id),
    member_id     UUID        NOT NULL REFERENCES members(id),
    shares_held   INT         NOT NULL DEFAULT 0,
    total_invested NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (group_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_share_holdings_group  ON share_holdings(group_id);
CREATE INDEX IF NOT EXISTS idx_share_holdings_member ON share_holdings(member_id);
