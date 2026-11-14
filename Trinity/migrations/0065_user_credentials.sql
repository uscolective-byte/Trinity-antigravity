-- 0065_user_credentials.sql: Email + Password authentication & User Profile Persistence
ALTER TABLE ops_users ADD COLUMN password_hash TEXT;
ALTER TABLE ops_users ADD COLUMN password_salt TEXT;
ALTER TABLE ops_users ADD COLUMN avatar_url TEXT;
ALTER TABLE ops_users ADD COLUMN last_login_at TEXT;
