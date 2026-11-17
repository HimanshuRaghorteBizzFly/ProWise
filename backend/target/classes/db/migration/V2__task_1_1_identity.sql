CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(320) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_users_status CHECK (status IN ('ACTIVE', 'DISABLED'))
);

CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email));

CREATE TABLE organizations (
    id UUID PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    timezone VARCHAR(100) NOT NULL,
    work_calendar JSONB NOT NULL DEFAULT '{}'::jsonb,
    state VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_organizations_slug UNIQUE (slug),
    CONSTRAINT ck_organizations_state CHECK (state IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED'))
);

CREATE TABLE memberships (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id),
    user_id UUID NOT NULL REFERENCES users (id),
    role_template VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_memberships_org_user UNIQUE (org_id, user_id),
    CONSTRAINT ck_memberships_status CHECK (status IN ('ACTIVE', 'DISABLED'))
);

CREATE INDEX idx_memberships_org_id ON memberships (org_id);
CREATE INDEX idx_memberships_user_id ON memberships (user_id);

CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id),
    refresh_token_hash VARCHAR(128) NOT NULL UNIQUE,
    family_id UUID NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_family_id ON sessions (family_id);

CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id),
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
);

CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens (user_id);
