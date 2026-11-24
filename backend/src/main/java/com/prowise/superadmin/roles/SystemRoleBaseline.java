package com.prowise.superadmin.roles;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

/**
 * Version-controlled baseline of the organization role templates: exactly what migrations V3 and V20 grant.
 * "Re-sync System Roles" and "Reset to baseline" restore these sets. A test checks that a freshly migrated
 * database matches this baseline, so a new migration that changes a template must update this class too.
 */
public final class SystemRoleBaseline {

    private SystemRoleBaseline() {}

    public static final UUID SUPER_ADMIN_DEFINITION_ID = UUID.fromString("20000000-0000-0000-0000-000000000001");
    public static final UUID PLATFORM_OPERATOR_DEFINITION_ID = UUID.fromString("20000000-0000-0000-0000-000000000002");
    public static final UUID OWNER_TEMPLATE_ID = UUID.fromString("10000000-0000-0000-0000-000000000001");

    /** The owner template keeps these keys: without them no tenant could govern its own organization. */
    public static final Set<String> OWNER_REQUIRED_KEYS = Set.of("org.manage", "role.manage");

    /** Template role id -> baseline permission keys (sorted). */
    public static final Map<UUID, Set<String>> ORGANIZATION_TEMPLATES = build();

    private static Map<UUID, Set<String>> build() {
        Map<UUID, Set<String>> map = new LinkedHashMap<>();
        map.put(template(1), sorted(List.of(
                "org.manage", "member.invite", "member.disable", "role.manage", "team.manage",
                "project.create", "project.read", "project.edit", "project.archive", "project.mode.change",
                "project.scope.change", "project.deadline.edit", "project.progress.report",
                "task.create", "task.assign", "task.update", "task.review",
                "repo.connect", "repo.read", "report.export", "audit.read")));
        map.put(template(2), sorted(List.of(
                "member.invite", "member.disable", "role.manage", "team.manage", "project.create", "project.read",
                "repo.connect", "repo.read", "report.export", "audit.read")));
        map.put(template(3), sorted(List.of(
                "project.create", "project.read", "project.edit", "project.mode.change", "project.scope.change",
                "project.deadline.edit", "task.create", "task.assign", "task.update", "repo.read", "report.export")));
        map.put(template(4), sorted(List.of(
                "team.manage", "project.read", "task.create", "task.assign", "task.update", "repo.read",
                "project.progress.verify")));
        map.put(template(5), sorted(List.of(
                "project.read", "project.edit", "task.update", "repo.read", "project.progress.report")));
        map.put(template(6), sorted(List.of("project.read", "task.review")));
        map.put(template(7), sorted(List.of("project.read")));
        return java.util.Collections.unmodifiableMap(map);
    }

    private static UUID template(int n) {
        return UUID.fromString("10000000-0000-0000-0000-00000000000" + n);
    }

    private static Set<String> sorted(List<String> keys) {
        return java.util.Collections.unmodifiableSet(new TreeSet<>(keys));
    }
}
