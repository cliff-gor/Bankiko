-- Per-group contribution enforcement threshold
ALTER TABLE sacco_groups
    ADD COLUMN IF NOT EXISTS min_contributions_required INT NOT NULL DEFAULT 3;

-- FCM device tokens for push notifications
CREATE TABLE IF NOT EXISTS device_tokens (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id),
    token      TEXT        NOT NULL,
    platform   VARCHAR(10) NOT NULL DEFAULT 'FCM',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);
