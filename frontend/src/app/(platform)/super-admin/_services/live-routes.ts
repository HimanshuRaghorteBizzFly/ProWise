/**
 * Super Admin routes backed by a real server API. Only these appear in the menu; any other Super Admin route renders
 * the "module not available yet" placeholder instead of local demo state. Add a route here only once its page
 * reads and writes through the typed client in src/lib/api.
 */
export const LIVE_SUPER_ADMIN_ROUTES: readonly string[] = [
  "/super-admin",
  "/super-admin/dashboard",
  "/super-admin/users",
  "/super-admin/organizations",
  "/super-admin/operators",
  "/super-admin/roles-permissions",
  "/super-admin/roles",
  "/super-admin/plans",
  "/super-admin/subscriptions",
  "/super-admin/invoices",
  "/super-admin/security-keys",
  "/super-admin/audit",
  "/super-admin/email-settings",
  "/super-admin/emails",
  "/super-admin/email-templates",
  "/super-admin/announcements",
  "/super-admin/account",
  "/super-admin/payments",
  "/super-admin/security",
  "/super-admin/access-approvals",
  "/super-admin/incidents",
  "/super-admin/support",
  "/super-admin/maintenance",
  "/super-admin/configuration",
  "/super-admin/reports",
  "/super-admin/settings",
];

const LIVE = new Set(LIVE_SUPER_ADMIN_ROUTES);

export function isLiveSuperAdminRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return LIVE.has(path);
}
