-- Task 4.1: GitHub App integration. An Owner/Admin connects GitHub ONCE for the organization by installing the Prowise
-- GitHub App on a GitHub account or organization; afterwards a manager picks one repository and branch per project
-- (while creating it, or later). Reuses the existing tables:
--   * project_repository_links: a GITHUB_APP link points at the installation; it stores no token and no per-repo
--     webhook secret (the App's own webhook, signed with GITHUB_APP_WEBHOOK_SECRET, delivers events).
--   * github_activity: imported commits / pull requests form the project's activity feed (scope FEED) with code-change
--     stats. Task evidence rows (scope EVIDENCE) are unchanged. Neither ever sets completion or progress (rule 9).
--   * github_webhook_deliveries: unchanged dedupe per connection and delivery id.
-- The legacy operator table github_repository_links (V9) has no org_id and text ids, so it is not used for tenant data.

-- 1. Installations: one GitHub App installation belongs to at most one organization while active.
CREATE TABLE github_app_installations (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    installation_id BIGINT NOT NULL,
    account_login VARCHAR(100) NOT NULL,
    account_type VARCHAR(20) NOT NULL,
    repository_selection VARCHAR(10) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    installed_by UUID NULL REFERENCES users (id),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_github_app_installations_status CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REMOVED')),
    CONSTRAINT ck_github_app_installations_account CHECK (account_type IN ('User', 'Organization', 'Enterprise')),
    CONSTRAINT uq_github_app_installations_org_id UNIQUE (org_id, id)
);
CREATE INDEX idx_github_app_installations_org ON github_app_installations (org_id, status);
CREATE UNIQUE INDEX uq_github_app_installations_live
    ON github_app_installations (installation_id) WHERE status <> 'REMOVED';

-- 2. One-time "install the app" requests (the OAuth state). Only the SHA-256 of the random state is stored.
CREATE TABLE github_app_install_states (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    state_hash VARCHAR(64) NOT NULL UNIQUE,
    return_to VARCHAR(300) NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_github_app_install_states_org ON github_app_install_states (org_id, created_at);

-- 3. Project links through an installation (same organization, enforced by the composite key).
ALTER TABLE project_repository_links
    ADD COLUMN installation_ref UUID NULL,
    ADD COLUMN repo_private BOOLEAN NULL;
ALTER TABLE project_repository_links ADD CONSTRAINT fk_project_repository_links_installation
    FOREIGN KEY (org_id, installation_ref) REFERENCES github_app_installations (org_id, id);
ALTER TABLE project_repository_links DROP CONSTRAINT ck_project_repository_links_secrets;
ALTER TABLE project_repository_links ADD CONSTRAINT ck_project_repository_links_secrets
    CHECK (provider = 'LEGACY'
        OR (provider = 'GITHUB_TOKEN' AND owner_name IS NOT NULL AND repo_short_name IS NOT NULL
            AND webhook_secret_ciphertext IS NOT NULL)
        OR (provider = 'GITHUB_APP' AND owner_name IS NOT NULL AND repo_short_name IS NOT NULL
            AND installation_ref IS NOT NULL AND token_ciphertext IS NULL));
-- Each project has its own repository: a repository is live on at most one project of an organization.
CREATE UNIQUE INDEX uq_project_repository_links_org_repo
    ON project_repository_links (org_id, lower(repo_name)) WHERE provider <> 'LEGACY' AND status <> 'DISCONNECTED';
CREATE INDEX idx_project_repository_links_installation ON project_repository_links (installation_ref)
    WHERE installation_ref IS NOT NULL;

-- 4. Drafts may pick a repository through an installation instead of a token.
ALTER TABLE project_drafts ADD COLUMN repo_installation_ref UUID NULL REFERENCES github_app_installations (id);
ALTER TABLE project_drafts DROP CONSTRAINT ck_project_drafts_repo;
ALTER TABLE project_drafts ADD CONSTRAINT ck_project_drafts_repo CHECK (
    (repo_full_name IS NULL AND repo_token_ciphertext IS NULL AND repo_installation_ref IS NULL)
    OR (repo_full_name IS NOT NULL AND ((repo_token_ciphertext IS NULL) <> (repo_installation_ref IS NULL))));

-- 5. Activity feed with code-change stats (files changed, lines added / removed; the diff itself stays on GitHub).
ALTER TABLE github_activity
    ADD COLUMN scope VARCHAR(10) NOT NULL DEFAULT 'EVIDENCE',
    ADD COLUMN additions INT NULL,
    ADD COLUMN deletions INT NULL,
    ADD COLUMN files_changed INT NULL,
    ADD COLUMN base_branch VARCHAR(100) NULL;
ALTER TABLE github_activity ADD CONSTRAINT ck_github_activity_scope CHECK (scope IN ('EVIDENCE', 'FEED'));
ALTER TABLE github_activity ADD CONSTRAINT ck_github_activity_source_v2
    CHECK (source IS NULL OR source IN ('FETCH', 'WEBHOOK', 'IMPORT'));
ALTER TABLE github_activity DROP CONSTRAINT ck_github_activity_source;
-- Solo evidence (project-level, matched by the project key) and the feed must not collide.
DROP INDEX uq_github_activity_project_ref;
CREATE UNIQUE INDEX uq_github_activity_project_ref
    ON github_activity (project_id, event_type, (COALESCE(sha, 'pr-' || pr_number::text)))
    WHERE work_item_id IS NULL AND source IS NOT NULL AND scope = 'EVIDENCE';
CREATE UNIQUE INDEX uq_github_activity_feed_ref
    ON github_activity (project_id, event_type, (COALESCE(sha, 'pr-' || pr_number::text)))
    WHERE scope = 'FEED';
CREATE INDEX idx_github_activity_feed ON github_activity (org_id, project_id, occurred_at DESC) WHERE scope = 'FEED';
