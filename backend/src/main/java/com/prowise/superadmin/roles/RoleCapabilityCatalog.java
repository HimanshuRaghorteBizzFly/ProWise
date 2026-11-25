package com.prowise.superadmin.roles;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import com.prowise.authz.PermissionKey;
import com.prowise.operator.OperatorDTOs;
import com.prowise.operator.OperatorService;

/**
 * The capability catalog shown on the Roles &amp; Permissions page, built only from what the system enforces:
 * <ul>
 *   <li>Organization capabilities: every {@link PermissionKey} (checked by PermissionService through grants).</li>
 *   <li>Operator capabilities: {@code module:action} keys exactly as operator tokens carry them (operator permission
 *       catalog, department permissions from V5, and the extra keys Main Platform Operators receive at sign-in).</li>
 *   <li>Platform root: the areas behind the PLATFORM_SUPER_ADMIN authority. Super Admin only, never assignable.</li>
 * </ul>
 */
@Component
public class RoleCapabilityCatalog {

    public static final String SCOPE_PLATFORM = "PLATFORM";
    public static final String SCOPE_ORGANIZATION = "ORGANIZATION";

    /** Keys OperatorAuthService adds for Main Platform Operators on top of every department permission. */
    static final List<String> MAIN_OPERATOR_EXTRA_KEYS = List.of(
            "team.workload:view", "team.workload:assign", "reports.operational:view", "reports.operational:export",
            "incidents.management:assign", "support.tickets:assign");

    private final JdbcTemplate jdbc;
    private final OperatorService operators;

    public RoleCapabilityCatalog(JdbcTemplate jdbc, OperatorService operators) {
        this.jdbc = jdbc;
        this.operators = operators;
    }

    public record Capability(
            String key,
            String moduleId,
            String moduleName,
            String group,
            String scope,
            String action,
            String label,
            String description,
            String risk,
            boolean superAdminOnly) {}

    /** The full catalog, in display order (platform root, organization, operator). */
    public List<Capability> all() {
        List<Capability> list = new ArrayList<>(platformRoot());
        list.addAll(organization());
        list.addAll(operator());
        return list;
    }

    public List<Capability> platformRoot() {
        String m = "platform-root";
        String n = "Platform Root";
        String g = "Platform Root (Super Admin only)";
        return List.of(
                root(m, n, g, "platform.organizations.manage", "manage", "Govern organizations",
                        "Provision, edit, suspend, archive and restore tenant organizations"),
                root(m, n, g, "platform.users.manage", "manage", "Govern platform users",
                        "Platform user accounts, status and credential resets"),
                root(m, n, g, "platform.operators.manage", "manage", "Govern platform operators",
                        "Invite operators, set access levels, departments and permission overrides"),
                root(m, n, g, "platform.roles.manage", "manage", "Govern roles & permissions",
                        "Role templates, custom roles and capability baselines (this page)"),
                root(m, n, g, "platform.settings.manage", "manage", "Platform settings",
                        "Policies, branding, feature flags, SMTP and integration settings"),
                root(m, n, g, "platform.communications.manage", "manage", "Platform communications",
                        "Announcements and system email templates"),
                root(m, n, g, "platform.billing.manage", "manage", "Commercial records",
                        "Plans, subscriptions, invoices and payments (billing is dormant)"),
                root(m, n, g, "platform.security.manage", "manage", "Platform security",
                        "Security center, platform keys and session controls"),
                root(m, n, g, "platform.audit.read", "read", "Platform audit & reports",
                        "Platform audit trail and cross-tenant reports"));
    }

    private static Capability root(String moduleId, String moduleName, String group, String key, String action,
            String label, String description) {
        return new Capability(key, moduleId, moduleName, group, SCOPE_PLATFORM, action, label, description, "HIGH", true);
    }

    public List<Capability> organization() {
        List<Capability> list = new ArrayList<>();
        for (PermissionKey key : PermissionKey.values()) {
            list.add(organizationCapability(key));
        }
        return list;
    }

    private static Capability organizationCapability(PermissionKey key) {
        String g = "Organization (tenant & project scope)";
        return switch (key) {
            case ORG_MANAGE -> org(key, "organization", "Organization", g, "manage", "Manage organization",
                    "Organization profile, settings, calendar and lifecycle", "HIGH");
            case MEMBER_INVITE -> org(key, "members", "Members", g, "invite", "Invite members",
                    "Send invitations to join the organization", "MEDIUM");
            case MEMBER_DISABLE -> org(key, "members", "Members", g, "disable", "Disable members",
                    "Disable and re-enable memberships", "HIGH");
            case ROLE_MANAGE -> org(key, "access", "Roles & Access", g, "manage", "Manage roles & grants",
                    "Create organization roles and grant or revoke roles (only keys the actor holds)", "HIGH");
            case TEAM_MANAGE -> org(key, "teams", "Teams", g, "manage", "Manage teams",
                    "Create teams and change their members", "MEDIUM");
            case PROJECT_CREATE -> org(key, "projects", "Projects", g, "create", "Create projects",
                    "Create new projects", "MEDIUM");
            case PROJECT_READ -> org(key, "projects", "Projects", g, "read", "View projects",
                    "See projects, their progress and health", "LOW");
            case PROJECT_EDIT -> org(key, "projects", "Projects", g, "edit", "Edit project details",
                    "Change project details", "MEDIUM");
            case PROJECT_ARCHIVE -> org(key, "projects", "Projects", g, "archive", "Archive projects",
                    "Archive and restore projects", "HIGH");
            case PROJECT_MODE_CHANGE -> org(key, "projects", "Projects", g, "mode", "Change delivery mode",
                    "Switch between Individual and Structured mode", "HIGH");
            case PROJECT_SCOPE_CHANGE -> org(key, "projects", "Projects", g, "scope", "Change approved scope",
                    "Record scope changes against the approved baseline", "HIGH");
            case PROJECT_DEADLINE_EDIT -> org(key, "projects", "Projects", g, "deadline", "Edit deadlines",
                    "Change target dates and deadlines", "MEDIUM");
            case PROJECT_PROGRESS_REPORT -> org(key, "progress", "Progress", g, "report", "Report progress",
                    "Submit progress check-ins", "MEDIUM");
            case PROJECT_PROGRESS_OVERRIDE -> org(key, "progress", "Progress", g, "override", "Override progress",
                    "Override a reported progress figure", "HIGH");
            case PROJECT_PROGRESS_VERIFY -> org(key, "progress", "Progress", g, "verify", "Approve check-ins",
                    "Approve or reject pending progress check-ins", "MEDIUM");
            case TASK_CREATE -> org(key, "work", "Work & Tasks", g, "create", "Create tasks",
                    "Break work down into tasks", "MEDIUM");
            case TASK_ASSIGN -> org(key, "work", "Work & Tasks", g, "assign", "Assign tasks",
                    "Assign and reassign tasks", "MEDIUM");
            case TASK_UPDATE -> org(key, "work", "Work & Tasks", g, "update", "Update tasks",
                    "Update task status and details", "LOW");
            case TASK_REVIEW -> org(key, "review", "Review", g, "review", "Review work",
                    "Accept submitted work or send it back for rework", "MEDIUM");
            case REPO_CONNECT -> org(key, "repositories", "Repositories", g, "connect", "Connect repositories",
                    "Connect and disconnect Git repositories", "HIGH");
            case REPO_READ -> org(key, "repositories", "Repositories", g, "read", "View repository evidence",
                    "See linked Git activity (evidence only)", "LOW");
            case REPORT_EXPORT -> org(key, "reports", "Reports", g, "export", "Export reports",
                    "Export delivery reports", "MEDIUM");
            case AUDIT_READ -> org(key, "audit", "Audit", g, "read", "Read audit log",
                    "Read the organization's audit log", "LOW");
        };
    }

    private static Capability org(PermissionKey key, String moduleId, String moduleName, String group, String action,
            String label, String description, String risk) {
        return new Capability(key.value(), moduleId, moduleName, group, SCOPE_ORGANIZATION, action, label, description,
                risk, false);
    }

    /** Operator capabilities: catalog modules x actions, plus any department permission or Main Operator extra key. */
    public List<Capability> operator() {
        Map<String, Capability> byKey = new LinkedHashMap<>();
        String g = "Platform Operations (operator scope)";
        Map<String, OperatorDTOs.PermissionCatalogItem> modules = new LinkedHashMap<>();
        for (OperatorDTOs.PermissionCatalogItem item : operators.listPermissionCatalog()) {
            modules.put(item.key(), item);
            for (String action : item.actions()) {
                String key = item.key() + ":" + action;
                byKey.put(key, operatorCapability(key, item.key(), item.category(), item.name(), action, item.description(), g));
            }
        }
        List<String> extra = new ArrayList<>(departmentKeys());
        extra.addAll(MAIN_OPERATOR_EXTRA_KEYS);
        for (String key : extra) {
            if (byKey.containsKey(key)) continue;
            int colon = key.indexOf(':');
            String moduleKey = key.substring(0, colon);
            String action = key.substring(colon + 1);
            OperatorDTOs.PermissionCatalogItem item = modules.get(moduleKey);
            String category = item != null ? item.category() : categoryFor(moduleKey);
            String name = item != null ? item.name() : humanize(moduleKey);
            String description = item != null ? item.description() : "Granted to Main Platform Operators at sign-in";
            byKey.put(key, operatorCapability(key, moduleKey, category, name, action, description, g));
        }
        return new ArrayList<>(byKey.values());
    }

    private static Capability operatorCapability(String key, String moduleKey, String category, String moduleLabel,
            String action, String description, String group) {
        String risk = switch (action) {
            case "view" -> "LOW";
            case "delete", "execute" -> "HIGH";
            default -> "MEDIUM";
        };
        String moduleId = "ops-" + category.toLowerCase(java.util.Locale.ROOT).replaceAll("[^a-z0-9]+", "-");
        return new Capability(key, moduleId, "Operator · " + category, group, SCOPE_PLATFORM, action,
                capitalize(action) + " · " + moduleLabel, description, risk, false);
    }

    private static String categoryFor(String moduleKey) {
        if (moduleKey.startsWith("team.")) return "Operations";
        if (moduleKey.startsWith("reports.")) return "Account & Audit";
        return "Operations";
    }

    private static String humanize(String moduleKey) {
        String[] parts = moduleKey.replace('.', ' ').replace('_', ' ').split(" ");
        StringBuilder out = new StringBuilder();
        for (String p : parts) {
            if (p.isEmpty()) continue;
            if (!out.isEmpty()) out.append(' ');
            out.append(capitalize(p));
        }
        return out.toString();
    }

    private static String capitalize(String s) {
        return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    /** Every department permission as an operator token key ({@code module:action}). */
    public Set<String> departmentKeys() {
        return new TreeSet<>(jdbc.query(
                "SELECT DISTINCT module_key || ':' || permission_action AS k FROM operator_department_permissions",
                (rs, rowNum) -> rs.getString("k")));
    }

    /** What a Main Platform Operator receives at sign-in (the Platform Operator role's capability set). */
    public Set<String> platformOperatorKeys() {
        Set<String> keys = new TreeSet<>(departmentKeys());
        keys.addAll(MAIN_OPERATOR_EXTRA_KEYS);
        return keys;
    }

    public Set<String> keysOf(List<Capability> capabilities) {
        Set<String> keys = new LinkedHashSet<>();
        for (Capability c : capabilities) keys.add(c.key());
        return Collections.unmodifiableSet(keys);
    }
}
