# Legacy seed (not run by Flyway)

`V12__seed_development_logins.sql` was a Flyway migration that seeded known-password login accounts.
It ran in every environment and failed on an empty database (it needs an `acme` organization that it
never creates). It now lives here only for reference and for databases that already applied it.

The same accounts are created in the `dev` profile only by
`backend/src/main/java/com/prowise/identity/DevelopmentDataInitializer.java`.

Databases that already applied V12: reset them, or run `flyway repair` once so Flyway marks V12 as deleted.
