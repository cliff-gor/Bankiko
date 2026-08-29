-- Fineract needs SUPER privileges for stored procedures
GRANT ALL PRIVILEGES ON fineract_default.* TO 'fineract'@'%';
FLUSH PRIVILEGES;
