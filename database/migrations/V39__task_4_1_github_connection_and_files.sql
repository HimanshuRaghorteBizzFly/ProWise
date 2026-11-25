-- Tasks 4.1 / 4.2 / 4.4 (only the parts the project delivery flow needs). Extends the existing tables instead of
-- creating parallel ones:
--   * project_repository_links: one connected GitHub repository per project. The fine-grained read-only token and the
--     webhook secret are stored ENCRYPTED (AES-GCM, APP_ENCRYPTION_KEY) and are never returned by the API or logged.
--   * github_webhook_deliveries: one row per signed delivery id, so a replayed delivery never duplicates activity.
--   * github_activity: commits and pull requests matched to a task by its key (e.g. PRW-12). Evidence only: Git
--     activity never sets completion or progress (rule 9).
--   * file_metadata: project documents and screenshots on local disk (behind a storage interface). Uploads are first
--     staged (no project yet, e.g. while the create wizard is open) and attached when the project is saved.

-- 1. GitHub connection on the existing repository link.
ALTER TABLE project_repository_links
    ADD COLUMN provider VARCHAR(20) NOT NULL DEFAULT 'LEGACY',
    ADD COLUMN owner_name VARCHAR(100) NULL,
    ADD COLUMN repo_short_name VARCHAR(100) NULL,
    ADD COLUMN token_ciphertext TEXT NULL,
    ADD COLUMN webhook_secret_ciphertext TEXT NULL,
    ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN connected_by UUID NULL REFERENCES users (id),
    ADD COLUMN last_synced_at TIMESTAMPTZ NULL,
    ADD COLUMN last_error VARCHAR(500) NULL,
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE project_repository_links ADD CONSTRAINT ck_project_repository_links_provider
    CHECK (provider IN ('LEGACY', 'GITHUB_TOKEN', 'GITHUB_APP'));
ALTER TABLE project_repository_links ADD CONSTRAINT ck_project_repository_links_status
    CHECK (status IN ('ACTIVE', 'DISCONNECTED', 'ERROR'));
ALTER TABLE project_repository_links ADD CONSTRAINT ck_project_repository_links_secrets
    CHECK (provider = 'LEGACY' OR (owner_name IS NOT NULL AND repo_short_name IS NOT NULL
        AND webhook_secret_ciphertext IS NOT NULL));
-- Tenant-safe: the project of a connection belongs to the same organization.
ALTER TABLE project_repository_links ADD CONSTRAINT fk_project_repository_links_project_org
    FOREIGN KEY (org_id, project_id) REFERENCES projects (org_id, id) ON DELETE CASCADE NOT VALID;
-- One live GitHub connection per project.
CREATE UNIQUE INDEX uq_project_repository_links_github
    ON project_repository_links (project_id) WHERE provider <> 'LEGACY' AND status <> 'DISCONNECTED';

-- 2. Webhook delivery dedupe (replays are acknowledged and ignored).
CREATE TABLE github_webhook_deliveries (
    connection_id VARCHAR(64) NOT NULL REFERENCES project_repository_links (id) ON DELETE CASCADE,
    delivery_id VARCHAR(100) NOT NULL,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    event VARCHAR(50) NOT NULL,
    matched INT NOT NULL DEFAULT 0,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (connection_id, delivery_id)
);
CREATE INDEX idx_github_webhook_deliveries_org ON github_webhook_deliveries (org_id, received_at);

-- 3. Commit / pull request evidence linked to one task.
ALTER TABLE github_activity
    ADD COLUMN work_item_id VARCHAR(64) NULL REFERENCES work_items (id) ON DELETE CASCADE,
    ADD COLUMN url VARCHAR(500) NULL,
    ADD COLUMN occurred_at TIMESTAMPTZ NULL,
    ADD COLUMN source VARCHAR(20) NULL,
    ADD COLUMN match_reason VARCHAR(20) NULL;
ALTER TABLE github_activity ADD CONSTRAINT ck_github_activity_source
    CHECK (source IS NULL OR source IN ('FETCH', 'WEBHOOK'));
ALTER TABLE github_activity ADD CONSTRAINT ck_github_activity_match
    CHECK (match_reason IS NULL OR match_reason IN ('MESSAGE', 'BRANCH', 'PULL_REQUEST'));
-- The same commit or pull request is linked to a task once, however often it is fetched or replayed.
CREATE UNIQUE INDEX uq_github_activity_task_ref
    ON github_activity (work_item_id, event_type, (COALESCE(sha, 'pr-' || pr_number::text)))
    WHERE work_item_id IS NOT NULL;
-- Solo projects have no tasks: their commits are matched by the project key and linked to the project only.
CREATE UNIQUE INDEX uq_github_activity_project_ref
    ON github_activity (project_id, event_type, (COALESCE(sha, 'pr-' || pr_number::text)))
    WHERE work_item_id IS NULL AND source IS NOT NULL;
CREATE INDEX idx_github_activity_task ON github_activity (org_id, work_item_id, occurred_at DESC);

-- 4. Stored files: kind, checksum, and staging before a project exists.
ALTER TABLE file_metadata
    ADD COLUMN kind VARCHAR(20) NOT NULL DEFAULT 'LEGACY',
    ADD COLUMN sha256 VARCHAR(64) NULL,
    ADD COLUMN uploaded_by_user UUID NULL REFERENCES users (id),
    ADD COLUMN attached_at TIMESTAMPTZ NULL;
ALTER TABLE file_metadata ADD CONSTRAINT ck_file_metadata_kind
    CHECK (kind IN ('LEGACY', 'PROJECT_DOCUMENT', 'SCREENSHOT'));
ALTER TABLE file_metadata ADD CONSTRAINT ck_file_metadata_size CHECK (file_size >= 0 AND file_size <= 20971520);
CREATE INDEX idx_file_metadata_work_item ON file_metadata (org_id, work_item_id);
CREATE INDEX idx_file_metadata_staged ON file_metadata (org_id, uploaded_by_user) WHERE project_id IS NULL;
