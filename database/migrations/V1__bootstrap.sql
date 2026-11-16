CREATE TABLE audit_log (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL,
    actor_id UUID,
    action VARCHAR(120) NOT NULL,
    target_type VARCHAR(120) NOT NULL,
    target_id UUID,
    occurred_at TIMESTAMPTZ NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_audit_log_org_id ON audit_log (org_id, occurred_at DESC);

CREATE TABLE outbox_event (
    event_id UUID PRIMARY KEY,
    org_id UUID NOT NULL,
    aggregate_type VARCHAR(120) NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(120) NOT NULL,
    aggregate_version BIGINT NOT NULL,
    payload JSONB NOT NULL,
    state VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    available_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ,
    attempt_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_outbox_event_org_id ON outbox_event (org_id, state, available_at);
CREATE INDEX idx_outbox_event_pending ON outbox_event (state, available_at);

CREATE TABLE shedlock (
    name VARCHAR(64) PRIMARY KEY,
    lock_until TIMESTAMP(3) NOT NULL,
    locked_at TIMESTAMP(3) NOT NULL,
    locked_by VARCHAR(255) NOT NULL
);
