-- Approved decision D9 (Phase 2): public self-service signup must verify the email address before the account
-- can sign in. Signup stores the chosen password on a PENDING_ACTIVATION account and emails a single-use link.
-- The link token lives in the existing token table (hash only) with a third purpose, VERIFY.
-- No new table and no change to existing rows.
ALTER TABLE password_reset_tokens DROP CONSTRAINT ck_password_reset_tokens_purpose;
ALTER TABLE password_reset_tokens ADD CONSTRAINT ck_password_reset_tokens_purpose
    CHECK (purpose IN ('RESET', 'SETUP', 'VERIFY'));
