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

-- Connected social accounts, one per platform per user. access_token is encrypted
-- with SECRET_KEY (api/instagram.py); profile holds display details (picture, account type).
CREATE TABLE IF NOT EXISTS social_accounts (
    user_id          UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    platform         TEXT NOT NULL,
    account_id       TEXT NOT NULL,
    username         TEXT NOT NULL DEFAULT '',
    profile          JSONB NOT NULL DEFAULT '{}'::jsonb,
    access_token     TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ,
    connected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, platform)
);

-- Images staged for publishing. Instagram fetches post media from a public URL, so each
-- upload gets an unguessable token and is deleted after publishing (or within a day).
CREATE TABLE IF NOT EXISTS publish_media (
    token      TEXT PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    data       BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS publish_media_created_idx ON publish_media (created_at);

-- ---- guardrails (backend/guardrails, docs/guardrails.md) ------------------------------

-- Daily usage per creator and bucket (design, research, assist, chat, trend, upload, publish).
CREATE TABLE IF NOT EXISTS usage_counters (
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    bucket  TEXT NOT NULL,
    day     DATE NOT NULL,
    used    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, bucket, day)
);

-- AI calls and guardrail decisions. Sizes, hashes and verdicts only, never the text.
CREATE TABLE IF NOT EXISTS ai_audit (
    id            BIGSERIAL PRIMARY KEY,
    user_id       UUID REFERENCES users (id) ON DELETE SET NULL,
    endpoint      TEXT NOT NULL DEFAULT '',
    kind          TEXT NOT NULL,
    outcome       TEXT NOT NULL,
    model         TEXT NOT NULL DEFAULT '',
    prompt_sha256 TEXT NOT NULL DEFAULT '',
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    latency_ms    INTEGER NOT NULL DEFAULT 0,
    detail        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_audit_created_idx ON ai_audit (created_at);
CREATE INDEX IF NOT EXISTS ai_audit_user_idx ON ai_audit (user_id, created_at DESC);

-- Kill switches (python -m guardrails.flags).
CREATE TABLE IF NOT EXISTS app_flags (
    name       TEXT PRIMARY KEY,
    enabled    BOOLEAN NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pipeline runs saved in the local LangGraph store, so they can be purged on schedule
-- and when an account is deleted.
CREATE TABLE IF NOT EXISTS pipeline_threads (
    thread_id  TEXT PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pipeline_threads_created_idx ON pipeline_threads (created_at);

-- Chat conversations. Each keeps at most CONTEXT_WINDOW_TOKENS of history.
CREATE TABLE IF NOT EXISTS chat_conversations (
    id         TEXT PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title      TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chat_messages (
    id              BIGSERIAL PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES chat_conversations (id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content         TEXT NOT NULL,
    tokens          INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_conversation_idx ON chat_messages (conversation_id, id);

-- Instagram sign-in links are single use.
CREATE TABLE IF NOT EXISTS oauth_nonces (
    nonce_hash TEXT PRIMARY KEY,
    expires_at TIMESTAMPTZ NOT NULL
);

-- Publish requests, keyed by a client-generated id so a retry never posts twice.
CREATE TABLE IF NOT EXISTS publish_log (
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    request_id TEXT NOT NULL,
    status     TEXT NOT NULL,
    result     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, request_id)
);
