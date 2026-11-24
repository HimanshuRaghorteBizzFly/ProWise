# Development Seed Data

Predefined demo login accounts and organizations are managed via Spring Boot development seeders rather than raw SQL migrations, ensuring zero risk of seeding demo accounts in production.

## Pwise Demo Organization & Users

Seeded under the existing organization owned by **Dipak Chavan**:
- **Organization Name:** `example`
- **Organization ID:** `6cea41af-fffd-4160-9e01-59e7d88e144d`
- **Owner:** Dipak Chavan (`dc741094@gmail.com`)

### Demo Credentials

| Role | User | Email | Password | Must Change Password | Target Dashboard |
|---|---|---|---|---|---|
| `ORGANIZATION_OWNER` | Dipak Chavan | `dc741094@gmail.com` | `Owner@Pwise2026` | `false` | `/org/6cea41af-fffd-4160-9e01-59e7d88e144d/owner/dashboard` |
| `ORGANIZATION_ADMIN` | Organization Admin | `orgadmin@pwise.demo` | `Admin@Pwise2026` | `false` | `/org/6cea41af-fffd-4160-9e01-59e7d88e144d/admin/dashboard` |
| `PROJECT_MANAGER` | Project Manager | `manager@pwise.demo` | `Manager@Pwise2026` | `false` | `/org/6cea41af-fffd-4160-9e01-59e7d88e144d/manager/dashboard` |
| `TEAM_LEAD` | Team Lead | `teamlead@pwise.demo` | `TeamLead@Pwise2026` | `false` | `/org/6cea41af-fffd-4160-9e01-59e7d88e144d/lead/dashboard` |
| `DEVELOPER` | Developer | `developer@pwise.demo` | `Developer@Pwise2026` | `false` | `/org/6cea41af-fffd-4160-9e01-59e7d88e144d/developer/dashboard` |
| `QA_REVIEWER` | QA Reviewer | `qa@pwise.demo` | `QA@Pwise2026` | `false` | `/org/6cea41af-fffd-4160-9e01-59e7d88e144d/reviewer/dashboard` |

## Execution & Protection Rules

- **Seeder Class:** `com.prowise.identity.DemoUserSeeder` (implements Spring Boot `ApplicationRunner`)
- **Active Profiles:** Enabled in `dev` and `local` profiles (`@Profile({"dev", "local"})`).
- **Production Guard:** Refuses execution immediately with `IllegalStateException` if `prod` or `production` profiles are detected.
- **Idempotency:** Safe to run repeatedly; preserves existing user IDs, owner constraints, memberships, and grants without creating duplicates.
- **Password Security:** All passwords are hash-encoded using Spring Security `BCryptPasswordEncoder`. Plain-text passwords and `pgcrypto` are never stored/used.
- **Permissions:** Automatically links active memberships, user_roles, and organization-scoped grants (`grants` table) using existing role templates.

### Running Locally

To start the backend with the `dev` profile (which runs the seeder automatically on boot):

```bash
# Maven
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev

# Windows PowerShell
cd backend; .\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=dev"
```

To run the full verification test suite:

```bash
cd backend && ./mvnw test -Dtest=DemoUserSeederTest
```
