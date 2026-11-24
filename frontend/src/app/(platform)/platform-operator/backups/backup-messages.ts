/** What the operator sees for the backup run refusals (POST /v1/operator/backups). */
export const BACKUP_NOT_CONFIGURED_MESSAGE =
  "Backups are not configured on the server: set PROWISE_BACKUP_DIR (and PROWISE_PG_DUMP_PATH if pg_dump is not on PATH)";
export const BACKUP_RUNNING_MESSAGE = "A backup is already running. Wait for it to finish before starting another.";

/** Error code -> message, passed to `useOperatorMutation` so the notice explains the refusal. */
export const BACKUP_CODE_MESSAGES: Record<string, string> = {
  BACKUP_NOT_CONFIGURED: BACKUP_NOT_CONFIGURED_MESSAGE,
  BACKUP_RUNNING: BACKUP_RUNNING_MESSAGE,
};

/** How often the list is re-read while a run is in progress. */
export const BACKUP_POLL_MS = 5000;
