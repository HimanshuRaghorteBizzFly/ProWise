-- Create Project as a multi-step flow: step 1 saves a DRAFT that only its creator sees. Documents (staged uploads),
-- phases and tasks, the GitHub repository, people and approvers attach to the draft step by step. "Create project"
-- activates it: the project is created through the guided setup in ONE transaction (audit + outbox) and the draft
-- records which project it became. Drafts never appear in project lists, counts or progress (separate table).
-- The repository token is stored encrypted (APP_ENCRYPTION_KEY) and never returned.

CREATE TABLE project_drafts (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users (id),
    status VARCHAR(12) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVATED', 'DISCARDED')),
    -- The setup request built so far (basics, documents, phases, tasks, people, approvers), snake_case JSON.
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    repo_full_name VARCHAR(201) NULL,
    repo_default_branch VARCHAR(100) NULL,
    repo_token_ciphertext TEXT NULL,
    project_id VARCHAR(64) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_project_drafts_project_org FOREIGN KEY (org_id, project_id) REFERENCES projects (org_id, id),
    CONSTRAINT ck_project_drafts_activated CHECK ((status = 'ACTIVATED') = (project_id IS NOT NULL)),
    CONSTRAINT ck_project_drafts_repo CHECK ((repo_full_name IS NULL) = (repo_token_ciphertext IS NULL))
);
CREATE INDEX idx_project_drafts_creator ON project_drafts (org_id, created_by, status, updated_at DESC);
