-- V40: organization signup. The public signup form names the workspace (organization) the new account will own.
-- Nothing tenant-scoped exists before the address is confirmed (decision D9), so the requested name and timezone
-- wait here, keyed by the pending user. Confirming the emailed link creates the organization and the owner
-- membership (with its audit row and OrganizationCreated event) and removes this row in the same transaction.
-- Not a tenant table: there is no organization yet, so there is no org_id to carry.

CREATE TABLE pending_signup_workspaces (
    user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    organization_name VARCHAR(120) NOT NULL,
    timezone VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
