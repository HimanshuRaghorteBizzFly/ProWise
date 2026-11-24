-- V35: Non-secret platform integration configuration edited by the Super Admin (GET/PUT /v1/admin/integration-settings).
-- Secrets (GitHub App private key, client secret, webhook secret) are NOT stored here: they stay in environment
-- variables. Platform (non-tenant) table, so no org_id. Exactly one row, id 'default'.

CREATE TABLE IF NOT EXISTS platform_integration_settings (
    id                          VARCHAR(64)  PRIMARY KEY,
    github_app_slug             VARCHAR(100) NOT NULL DEFAULT '',
    github_client_id            VARCHAR(100) NOT NULL DEFAULT '',
    webhook_max_retries         INTEGER      NOT NULL DEFAULT 5,
    webhook_timeout_seconds     INTEGER      NOT NULL DEFAULT 10,
    webhook_signature_required  BOOLEAN      NOT NULL DEFAULT true,
    allowed_event_types         JSONB        NOT NULL DEFAULT '[]'::jsonb,
    updated_by                  VARCHAR(320),
    version                     BIGINT       NOT NULL DEFAULT 0,
    created_at                  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ck_platform_integration_settings_single CHECK (id = 'default'),
    CONSTRAINT ck_platform_integration_settings_retries CHECK (webhook_max_retries BETWEEN 0 AND 20),
    CONSTRAINT ck_platform_integration_settings_timeout CHECK (webhook_timeout_seconds BETWEEN 1 AND 120),
    CONSTRAINT ck_platform_integration_settings_events CHECK (jsonb_typeof(allowed_event_types) = 'array')
);
