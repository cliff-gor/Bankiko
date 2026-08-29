-- Seed users for development
-- Password for both: demo1234 (BCrypt 12 rounds)

INSERT INTO users (id, full_name, email, phone, password_hash, role, enabled)
VALUES
    (gen_random_uuid(), 'Admin Bankiko',   'admin@bankiko.com', '+254700000001',
     '$2b$12$q3YWmHwwjpdTx7Kdvksni.9f1R2Te4kTB9fMVy.bMkYSnDZXYNa3K', 'SYSTEM_ADMIN', TRUE),
    (gen_random_uuid(), 'Demo User',       'user@bankiko.com',  '+254700000002',
     '$2b$12$q3YWmHwwjpdTx7Kdvksni.9f1R2Te4kTB9fMVy.bMkYSnDZXYNa3K', 'MEMBER',       TRUE)
ON CONFLICT (email) DO NOTHING;
