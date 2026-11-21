-- Task 1.2: invitations, teams, ownership and handover (FR-002 / T02, FR-003 / T03).
-- Every table is tenant-scoped (org_id, indexed). History tables are append-only.

-- 1. Invitations: single-use, expiring, token stored only as a SHA-256 hash.
CREATE TABLE invitations (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    email VARCHAR(320) NOT NULL,
    template_role_id UUID NOT NULL REFERENCES role_templates (role_id),
    team_id UUID NULL,
    token_hash VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    expires_at TIMESTAMPTZ NOT NULL,
    invited_by UUID NOT NULL REFERENCES users (id),
    accepted_by UUID NULL REFERENCES users (id),
    accepted_at TIMESTAMPTZ NULL,
    revoked_at TIMESTAMPTZ NULL,
    send_count INT NOT NULL DEFAULT 1,
    last_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_invitations_token_hash UNIQUE (token_hash),
    CONSTRAINT uq_invitations_org_id UNIQUE (org_id, id),
    CONSTRAINT ck_invitations_status CHECK (status IN ('PENDING', 'ACCEPTED', 'REVOKED'))
);
CREATE INDEX idx_invitations_org ON invitations (org_id, status, created_at DESC);
-- At most one open invitation per email per organization.
CREATE UNIQUE INDEX uq_invitations_open_email ON invitations (org_id, lower(email)) WHERE status = 'PENDING';

-- 2. Teams and team members. Composite foreign keys keep members and leads inside the same organization.
CREATE TABLE teams (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500) NULL,
    lead_membership_id UUID NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_teams_org_id UNIQUE (org_id, id),
    CONSTRAINT fk_teams_lead_org FOREIGN KEY (org_id, lead_membership_id) REFERENCES memberships (org_id, id),
    CONSTRAINT ck_teams_status CHECK (status IN ('ACTIVE', 'ARCHIVED'))
);
CREATE INDEX idx_teams_org ON teams (org_id, status);
CREATE UNIQUE INDEX uq_teams_org_name ON teams (org_id, lower(name)) WHERE status = 'ACTIVE';

CREATE TABLE team_members (
    team_id UUID NOT NULL,
    org_id UUID NOT NULL,
    membership_id UUID NOT NULL,
    added_by UUID NOT NULL REFERENCES users (id),
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (team_id, membership_id),
    CONSTRAINT fk_team_members_team_org FOREIGN KEY (org_id, team_id) REFERENCES teams (org_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_team_members_membership_org FOREIGN KEY (org_id, membership_id) REFERENCES memberships (org_id, id)
);
CREATE INDEX idx_team_members_org ON team_members (org_id, membership_id);

ALTER TABLE invitations
    ADD CONSTRAINT fk_invitations_team_org FOREIGN KEY (org_id, team_id) REFERENCES teams (org_id, id);

-- 3. Exactly one Owner per organization (task 1.2): one owner membership and one owner grant.
CREATE UNIQUE INDEX uq_memberships_one_owner ON memberships (org_id) WHERE role_template = 'ORGANIZATION_OWNER';
CREATE UNIQUE INDEX uq_grants_one_owner ON grants (org_id) WHERE template_role_id = '10000000-0000-0000-0000-000000000001';

-- 4. Append-only history.
CREATE TABLE membership_history (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    membership_id UUID NOT NULL,
    user_id UUID NOT NULL,
    change_type VARCHAR(40) NOT NULL,
    previous_status VARCHAR(30) NULL,
    new_status VARCHAR(30) NULL,
    previous_role VARCHAR(50) NULL,
    new_role VARCHAR(50) NULL,
    actor_id UUID NULL,
    reason VARCHAR(500) NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_membership_history_org ON membership_history (org_id, membership_id, occurred_at DESC);

CREATE TABLE ownership_history (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    subject_type VARCHAR(40) NOT NULL,
    subject_id VARCHAR(64) NOT NULL,
    previous_owner_membership_id UUID NULL,
    new_owner_membership_id UUID NULL,
    change_type VARCHAR(40) NOT NULL,
    actor_id UUID NULL,
    reason VARCHAR(500) NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ownership_history_org ON ownership_history (org_id, subject_type, subject_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION prevent_people_history_change() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_membership_history_append_only
    BEFORE UPDATE OR DELETE ON membership_history
    FOR EACH ROW EXECUTE FUNCTION prevent_people_history_change();
CREATE TRIGGER trg_ownership_history_append_only
    BEFORE UPDATE OR DELETE ON ownership_history
    FOR EACH ROW EXECUTE FUNCTION prevent_people_history_change();

-- 5. Handover items: work left without an accountable owner after a departure ("needs owner").
CREATE TABLE handover_items (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    departed_membership_id UUID NOT NULL,
    subject_type VARCHAR(40) NOT NULL,
    subject_id VARCHAR(64) NOT NULL,
    subject_label VARCHAR(250) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'NEEDS_OWNER',
    replacement_membership_id UUID NULL,
    resolved_by UUID NULL,
    resolved_at TIMESTAMPTZ NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_handover_departed_org FOREIGN KEY (org_id, departed_membership_id) REFERENCES memberships (org_id, id),
    CONSTRAINT fk_handover_replacement_org FOREIGN KEY (org_id, replacement_membership_id) REFERENCES memberships (org_id, id),
    CONSTRAINT ck_handover_status CHECK (status IN ('NEEDS_OWNER', 'RESOLVED'))
);
CREATE INDEX idx_handover_items_org ON handover_items (org_id, status, created_at DESC);
