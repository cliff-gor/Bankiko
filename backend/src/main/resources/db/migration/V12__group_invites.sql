CREATE TABLE group_invites (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id     UUID        NOT NULL REFERENCES sacco_groups(id) ON DELETE CASCADE,
    token        VARCHAR(64) NOT NULL UNIQUE,
    created_by   UUID        NOT NULL REFERENCES users(id),
    expires_at   TIMESTAMP   NOT NULL,
    max_uses     INTEGER     DEFAULT NULL,
    use_count    INTEGER     NOT NULL DEFAULT 0,
    created_at   TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_group_invites_token ON group_invites(token);
CREATE INDEX idx_group_invites_group  ON group_invites(group_id);
