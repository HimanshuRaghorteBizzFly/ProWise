# Screen map: Organization Owner and Organization Admin

Maps blueprint section 4 ("Navigation: screens and entry points") to frontend routes for the two
org-level route families. Routes are `/org/{orgId}/owner/...` and `/org/{orgId}/admin/...`.

**Rules that apply to every row**
- The route family follows the membership's role template. Access is decided only by permission keys
  (`usePermissions().can`), never by role name. The server re-checks every request.
- Owner family gate: `org.manage`. Admin family gate: any of `member.invite`, `member.disable`,
  `role.manage`, `team.manage` (never `org.manage`).
- Every page has loading (skeleton), empty, error, 403 and access-lost states.
- "Later (task X)" marks features whose backend is not built. They are never shown as working.
- Typed fixtures are used only outside production (`NEXT_PUBLIC_USE_MOCKS=true` or backend unreachable)
  and always show the "Sample data" badge. Production builds show the Later state instead.

## Routes

| Blueprint screen (section 4) | Page | Owner route | Admin route | Key to view | Actions (key) | Data | Status |
|---|---|---|---|---|---|---|---|
| Overview | Dashboard | `owner/dashboard` | `admin/dashboard` | `project.read` | none | fixture | Later 2.1 / 5.3 (workload 5.4, audit 1.4) |
| (supports every screen) | Access Map | `owner/access` | `admin/access` | none | none | `GET /v1/me/permissions` | Ready (scope not reported by API yet) |
| Teams and People | Members | `owner/members` | `admin/members` | `role.manage` (API rule) | Invite (`member.invite`), Disable (`member.disable`), Transfer ownership (`org.manage` + current owner, Owner only) | `GET /v1/organizations/{id}/members` | List ready; actions Later 1.2 |
| Teams and People | Invitations | `owner/invitations` | `admin/invitations` | `member.invite` | Invite, Resend, Revoke (`member.invite`) | fixture | Later 1.2 |
| Teams and People | Teams | `owner/teams` | `admin/teams` | `team.manage` | Create, Edit, Archive (`team.manage`) | fixture | Later 1.2 |
| Settings and Activity | Roles & permissions | `owner/roles-permissions` | `admin/roles-permissions` | `role.manage` | Create, Edit, Grant (`role.manage`; cannot grant keys not held) | `GET /v1/organizations/{id}/roles` | Read ready; writes Later after 1.4 |
| All Projects | Projects portfolio | `owner/projects` | `admin/projects` | `project.read` | Create (`project.create`), Archive/Restore (`project.archive`, Owner only), Save filters | fixture | Later 2.1 / 2.4 / 5.3 |
| Overview (risks, Need Attention) | Health & risks | `owner/health` | `admin/health` | `project.read` | none | fixture | Later 5.1 |
| Repositories and Reports | Integrations (GitHub) | `owner/integrations` | `admin/integrations` | `repo.read` | Connect (`repo.connect`), Approve integration (`org.manage`, Owner only) | fixture | Later 4.1 / 4.2 |
| Repositories and Reports | Reports & exports | `owner/reports` | `admin/reports` | `project.read` | Export CSV (`report.export`) | fixture | Later 5.5 (workload 5.4, acceptance 2.4) |
| My Work and Notifications | Notifications | `owner/notifications` | `admin/notifications` | active membership | Mark read, Preferences | fixture | Later 5.2 |
| Settings and Activity | Audit & security | `owner/audit-logs` | `admin/audit-logs` | `audit.read` | none | fixture | Later 1.4 |
| Settings and Activity | Data & privacy | `owner/privacy` | none (Owner only) | `org.manage` | Request export, Request deletion | none | Later 5.6 |
| Settings and Activity | Organization settings | `owner/organization` | none (Owner only) | `org.manage` | Save (Later 1.1), calendar (Later 2.3), Transfer ownership in danger zone (current owner) | active organization | Read-only |

## Redirects (old links keep working)

| Old route | Redirects to |
|---|---|
| `owner` | `owner/dashboard` |
| `admin` | `admin/dashboard` |
| `owner/settings` | `owner/organization` |
| `admin/repositories` | `admin/integrations` |
| `admin/activity` | `admin/audit-logs` |
| `admin/settings` | `admin/access` |

## Hidden, not built

`owner/billing`, `owner/subscriptions` and `owner/workspaces` still exist as files but are not linked
from the sidebar and are out of V1 scope (no billing). Deleting them needs owner approval.

## Not in this map

Deferred items (decision D12): T08 MFA, T16 templates, T26 board/timeline views, T36 deployment details,
T45 escalation/digests, T46 health override. Operator support-access grants and "Owner unavailable"
handover lists were proposed (N1, N2) and not approved for this work.
