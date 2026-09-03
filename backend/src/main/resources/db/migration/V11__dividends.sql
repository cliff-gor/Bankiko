-- Dividend cycles per group
CREATE TABLE IF NOT EXISTS dividend_cycles (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id     UUID        NOT NULL REFERENCES sacco_groups(id),
    cycle_year   INT         NOT NULL,
    total_profit NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    declared_at  TIMESTAMPTZ,
    paid_at      TIMESTAMPTZ,
    status       VARCHAR(20) NOT NULL DEFAULT 'DRAFT', -- DRAFT | DECLARED | PAID
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (group_id, cycle_year)
);

-- Individual member dividend allocations
CREATE TABLE IF NOT EXISTS dividend_allocations (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id   UUID        NOT NULL REFERENCES dividend_cycles(id),
    member_id  UUID        NOT NULL REFERENCES members(id),
    shares     INT         NOT NULL,
    amount     NUMERIC(15,2) NOT NULL,
    paid       BOOLEAN     NOT NULL DEFAULT FALSE,
    paid_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (cycle_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_dividend_cycles_group  ON dividend_cycles(group_id);
CREATE INDEX IF NOT EXISTS idx_dividend_alloc_cycle   ON dividend_allocations(cycle_id);
CREATE INDEX IF NOT EXISTS idx_dividend_alloc_member  ON dividend_allocations(member_id);
