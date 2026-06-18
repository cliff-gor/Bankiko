-- Fineract requires two databases: fineract_tenants (routing) and fineract_default (tenant data)
CREATE DATABASE IF NOT EXISTS fineract_tenants CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS fineract_default CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON fineract_tenants.* TO 'fineract'@'%';
GRANT ALL PRIVILEGES ON fineract_default.* TO 'fineract'@'%';
FLUSH PRIVILEGES;
