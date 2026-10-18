-- Check if column exists and add if not
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatarUrl LONGTEXT NULL AFTER passwordHash;
