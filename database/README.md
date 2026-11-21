# Database

## Folders

- `migrations/`: versioned Flyway SQL migrations packaged into the backend.
- `init/`: SQL run once by the development PostgreSQL container on first initialization.
- `seed/`: development-only seed data; it is never run in production.
- `scripts/`: database backup, restore, and development reset helpers.

Never edit an applied migration. Add a new migration instead, using:

`V<n>__task_<x_y>_<description>.sql`

Every tenant table must include `org_id`, `version`, `created_at`, and `updated_at`.

The unapplied legacy project migration is retained under `migrations/retired/` with a `.disabled`
suffix; its schema is superseded by V15, with required compatibility columns added in V16. Pending
progress, calendar, and delivery migrations continue at V17 through V19 to avoid reusing applied
version numbers.

## Backup and restore

Set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` (or use their documented defaults), then run:

```bash
database/scripts/backup.sh
database/scripts/restore.sh database/backups/<backup-file>.dump
```

`database/scripts/reset-dev.sh` drops and recreates the development database and applies every migration. Seed data is development-only and must never run in production.
