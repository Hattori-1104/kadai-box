-- Migration number: 0002 	 2026-04-29T00:00:00.000Z

-- Add Box user info columns to users table
ALTER TABLE users ADD COLUMN box_user_id TEXT;
ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE users ADD COLUMN token_updated_at DATETIME;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_box_user_id ON users (box_user_id);

-- OAuth CSRF state (created_at is used to expire stale states)
CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
