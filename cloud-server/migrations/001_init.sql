-- ============================================================
-- Biznex License Server — initial schema
-- Run via: npm run migrate
-- ============================================================

-- Accounts (customers / admins)
CREATE TABLE IF NOT EXISTS accounts (
    id          SERIAL PRIMARY KEY,
    email       TEXT    NOT NULL UNIQUE,
    password    TEXT    NOT NULL,
    name        TEXT    NOT NULL,
    role        TEXT    NOT NULL DEFAULT 'customer',  -- 'customer' | 'admin'
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- License keys
CREATE TABLE IF NOT EXISTS license_keys (
    id              SERIAL PRIMARY KEY,
    key             TEXT    NOT NULL UNIQUE,          -- e.g. BZNX-XXXX-XXXX-XXXX
    account_id      INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    plan            TEXT    NOT NULL DEFAULT 'standard', -- 'standard' | 'pro' | 'enterprise'
    max_seats       INTEGER NOT NULL DEFAULT 1,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at      TIMESTAMPTZ,                      -- NULL = never expires
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Device activations (each seat)
CREATE TABLE IF NOT EXISTS activations (
    id              SERIAL PRIMARY KEY,
    license_key_id  INTEGER NOT NULL REFERENCES license_keys(id) ON DELETE CASCADE,
    device_id       TEXT    NOT NULL,                 -- fingerprint from Electron
    device_name     TEXT,                             -- optional human label
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (license_key_id, device_id)
);

-- Sync backups (one row per push, keeps last N per activation)
CREATE TABLE IF NOT EXISTS sync_backups (
    id              SERIAL PRIMARY KEY,
    activation_id   INTEGER NOT NULL REFERENCES activations(id) ON DELETE CASCADE,
    file_path       TEXT    NOT NULL,                 -- server-side path
    file_size       INTEGER NOT NULL DEFAULT 0,
    checksum        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- App update releases
CREATE TABLE IF NOT EXISTS releases (
    id              SERIAL PRIMARY KEY,
    version         TEXT    NOT NULL UNIQUE,          -- semver e.g. 1.2.0
    platform        TEXT    NOT NULL,                 -- 'win32' | 'linux' | 'darwin'
    arch            TEXT    NOT NULL DEFAULT 'x64',
    download_url    TEXT    NOT NULL,
    release_notes   TEXT,
    is_stable       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Refresh tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          SERIAL PRIMARY KEY,
    account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    token       TEXT    NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_license_keys_account    ON license_keys(account_id);
CREATE INDEX IF NOT EXISTS idx_activations_license     ON activations(license_key_id);
CREATE INDEX IF NOT EXISTS idx_activations_device      ON activations(device_id);
CREATE INDEX IF NOT EXISTS idx_sync_backups_activation ON sync_backups(activation_id);
CREATE INDEX IF NOT EXISTS idx_releases_platform       ON releases(platform, arch);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_account  ON refresh_tokens(account_id);
