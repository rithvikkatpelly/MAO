-- Aurea Studio schema. Applied at startup; every statement is idempotent.

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_sub    TEXT UNIQUE NOT NULL,
    email         TEXT NOT NULL,
    name          TEXT NOT NULL DEFAULT '',
    picture_url   TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only a SHA-256 of each session token is stored; the token itself lives in the cookie.
CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    user_agent TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

-- brand: name, handle, accent, secondary, palette, mark, logo, avatar, template, font, hashtags
-- social: questionnaire answers (role, platforms, content types, formats, tone, audience, ...)
CREATE TABLE IF NOT EXISTS profiles (
    user_id      UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    brand        JSONB NOT NULL DEFAULT '{}'::jsonb,
    social       JSONB NOT NULL DEFAULT '{}'::jsonb,
    onboarded_at TIMESTAMPTZ,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
    id         TEXT PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    kind       TEXT NOT NULL,
    data       JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS projects_user_updated_idx ON projects (user_id, updated_at DESC);

-- Trend watch settings: { enabled, frequency, topic, last_run_at, last_status }
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trend JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Small per-user collections, one row per item, validated per kind in api/items.py:
-- idea (backlog), series, brand_kit, preset (saved design), font, metric (post performance)
CREATE TABLE IF NOT EXISTS user_items (
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,
    id         TEXT NOT NULL,
    data       JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, kind, id)
);
CREATE INDEX IF NOT EXISTS user_items_kind_idx ON user_items (user_id, kind, updated_at DESC);

-- Snapshots of a project: automatic while editing (at most one per 10 minutes),
-- on export, named by the creator, and a safety copy before any restore.
CREATE TABLE IF NOT EXISTS project_versions (
    id         BIGSERIAL PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    reason     TEXT NOT NULL,
    label      TEXT NOT NULL DEFAULT '',
    data       JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_versions_project_idx ON project_versions (project_id, created_at DESC);
