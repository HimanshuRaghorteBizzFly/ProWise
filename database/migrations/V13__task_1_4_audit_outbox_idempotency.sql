-- Task 1.4: commit changes, history and events together.
-- audit_log and outbox_event exist since V1; this adds the missing columns, makes audit append-only,
-- and adds idempotency keys and consumer de-duplication.

-- 1. Audit log: reason and before/after snapshots; rows can never be updated or deleted.
ALTER TABLE audit_log ADD COLUMN reason VARCHAR(500);
ALTER TABLE audit_log ADD COLUMN previous JSONB;
ALTER TABLE audit_log ADD COLUMN new JSONB;
ALTER TABLE audit_log ADD COLUMN request_id VARCHAR(100);
CREATE INDEX idx_audit_log_org_target ON audit_log (org_id, target_type, target_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION prevent_audit_log_change() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_log_append_only
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_change();

-- 2. Outbox: bounded retry with a visible FAILED state for operators.
ALTER TABLE outbox_event ADD COLUMN last_error VARCHAR(300);
ALTER TABLE outbox_event ADD COLUMN failed_at TIMESTAMPTZ;
ALTER TABLE outbox_event ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE outbox_event ADD CONSTRAINT ck_outbox_event_state CHECK (state IN ('PENDING', 'DONE', 'FAILED'));
CREATE INDEX idx_outbox_event_failed ON outbox_event (state, failed_at DESC) WHERE state = 'FAILED';

-- 3. Idempotency keys, scoped to caller + organization + route + key.
CREATE TABLE idempotency_key (
    id UUID PRIMARY KEY,
    org_id UUID REFERENCES organizations (id) ON DELETE CASCADE,
    caller_id UUID NOT NULL,
    route VARCHAR(300) NOT NULL,
    idem_key VARCHAR(200) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
    response_status INTEGER,
    response_body TEXT,
    response_content_type VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT ck_idempotency_key_status CHECK (status IN ('IN_PROGRESS', 'COMPLETED'))
);
-- org_id may be NULL (e.g. creating an organization); COALESCE keeps the scope unique either way.
CREATE UNIQUE INDEX uq_idempotency_key_scope ON idempotency_key (
    caller_id, COALESCE(org_id, '00000000-0000-0000-0000-000000000000'::uuid), route, idem_key);
CREATE INDEX idx_idempotency_key_org ON idempotency_key (org_id, created_at);

-- 4. Consumers de-duplicate by event_id: one row per (consumer, event), written with the consumer's effect.
CREATE TABLE processed_event (
    consumer VARCHAR(120) NOT NULL,
    event_id UUID NOT NULL REFERENCES outbox_event (event_id) ON DELETE CASCADE,
    org_id UUID NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (consumer, event_id)
);
CREATE INDEX idx_processed_event_org ON processed_event (org_id, processed_at);

-- 5. Memberships already carry version (V2); nothing to add for optimistic locking here.
