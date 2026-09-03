ALTER TABLE sacco_groups
    ADD COLUMN IF NOT EXISTS group_type VARCHAR(20) NOT NULL DEFAULT 'CHAMA',
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

-- Existing groups are Chama and already active — no status change needed
