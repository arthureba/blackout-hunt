CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  phone         TEXT NOT NULL,
  instagram     TEXT,
  qr1_time_ms   BIGINT,
  qr2_time_ms   BIGINT,
  qr3_time_ms   BIGINT,
  qr4_time_ms   BIGINT,
  total_time_ms BIGINT NOT NULL DEFAULT 0,
  total_qr      INT    NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_idx ON users (phone);

-- QR CODES
CREATE TABLE IF NOT EXISTS qr_codes (
  step         INT PRIMARY KEY CHECK (step BETWEEN 1 AND 4),
  is_active    BOOLEAN      NOT NULL DEFAULT FALSE,
  activated_at TIMESTAMPTZ
);

INSERT INTO qr_codes (step) VALUES (1),(2),(3),(4)
ON CONFLICT (step) DO NOTHING;

-- SYSTEM STATE (single-row)
CREATE TABLE IF NOT EXISTS system_state (
  id             INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  winner_user_id UUID REFERENCES users(id)
);

INSERT INTO system_state (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;
