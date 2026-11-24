package com.prowise.work;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.authz.PermissionService;
import com.prowise.project.ProjectService;
import com.prowise.project.ProjectService.ProjectResponse;
import com.prowise.work.WorkDTOs.AssignableItem;
import com.prowise.work.WorkDTOs.WorkItem;

/**
 * Task 3.1 cross-project reads: work items of every Structured project the caller may read, one work item by id, and
 * the work of the teams the caller leads or belongs to. Unreadable projects are absent; a foreign or unreadable item
 * is 404. Read-only: every change goes through WorkService / ScopeService / ReviewService.
 */
@Service
public class WorkQueryService {

    private static final List<String> STATES = List.of("TODO", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "DONE");

    private final JdbcTemplate jdbc;
    private final ProjectService projects;
    private final PermissionService permissions;
    private final WorkService work;

    public WorkQueryService(JdbcTemplate jdbc, ProjectService projects, PermissionService permissions, WorkService work) {
        this.jdbc = jdbc;
        this.projects = projects;
        this.permissions = permissions;
        this.work = work;
    }

    public record MemberWork(UUID membershipId, String email, boolean lead, int openTasks, BigDecimal openPoints, List<AssignableItem> tasks) {}

    public record TeamWork(UUID id, String name, String leadEmail, boolean youLead, List<MemberWork> members) {}

    /**
     * Tasks (leaves) of readable Structured projects. Filters: project, assignee ("me", "none" or a membership id),
     * state (TODO, IN_PROGRESS, BLOCKED, IN_REVIEW, DONE).
     */
    @Transactional(readOnly = true)
    public List<AssignableItem> workItems(UUID orgId, Authentication auth, String projectId, String assignee, String state) {
        UUID me = permissions.requireMembership(auth, orgId);
        String wantedState = state == null || state.isBlank() ? null : state.trim().toUpperCase(Locale.ROOT);
        if (wantedState != null && !STATES.contains(wantedState)) throw WorkService.validation("state", "must be TODO, IN_PROGRESS, BLOCKED, IN_REVIEW or DONE");
        UUID wantedAssignee = null;
        boolean unassigned = false;
        if (assignee != null && !assignee.isBlank()) {
            if ("me".equalsIgnoreCase(assignee)) wantedAssignee = me;
            else if ("none".equalsIgnoreCase(assignee)) unassigned = true;
            else {
                try {
                    wantedAssignee = UUID.fromString(assignee.trim());
                } catch (IllegalArgumentException e) {
                    throw WorkService.validation("assignee", "must be me, none or a member id");
                }
            }
        }
        List<AssignableItem> result = new ArrayList<>();
        for (ProjectResponse project : projects.readable(orgId, auth, "STRUCTURED")) {
            if (projectId != null && !projectId.isBlank() && !project.id().equals(projectId)) continue;
            for (WorkItem item : work.items(orgId, project.id())) {
                if (!item.leaf()) continue;
                if (wantedState != null && !wantedState.equals(item.state())) continue;
                if (unassigned && item.assignee() != null) continue;
                if (wantedAssignee != null && (item.assignee() == null || !wantedAssignee.equals(item.assignee().membershipId()))) continue;
                result.add(new AssignableItem(project.id(), project.key(), project.name(), item));
            }
        }
        return result;
    }

    /** One work item with its project, when the caller may read that project; otherwise 404 with no metadata. */
    @Transactional(readOnly = true)
    public AssignableItem workItem(UUID orgId, String itemId, Authentication auth) {
        String projectId = jdbc.query("""
                SELECT project_id FROM work_items WHERE id = ? AND org_id = ? AND created_by IS NOT NULL AND retired_at IS NULL
                  AND proposed_scope_version_id IS NULL
                """, (rs, n) -> rs.getString(1), itemId, orgId).stream().findFirst().orElseThrow(PermissionService::notFound);
        ProjectResponse project = projects.get(orgId, projectId, auth); // 404 when not readable
        WorkItem item = work.items(orgId, project.id()).stream().filter(i -> i.id().equals(itemId)).findFirst()
                .orElseThrow(PermissionService::notFound);
        return new AssignableItem(project.id(), project.key(), project.name(), item);
    }

    /** Teams the caller leads or belongs to, with each member's open tasks in projects the caller may read. */
    @Transactional(readOnly = true)
    public List<TeamWork> myTeams(UUID orgId, Authentication auth) {
        UUID me = permissions.requireMembership(auth, orgId);
        List<Map<String, Object>> teams = jdbc.queryForList("""
                SELECT t.id, t.name, t.lead_membership_id, lu.email AS lead_email FROM teams t
                LEFT JOIN memberships lm ON lm.id = t.lead_membership_id AND lm.org_id = t.org_id
                LEFT JOIN users lu ON lu.id = lm.user_id
                WHERE t.org_id = ? AND t.status = 'ACTIVE'
                  AND (t.lead_membership_id = ? OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = t.id AND tm.org_id = t.org_id AND tm.membership_id = ?))
                ORDER BY lower(t.name), t.id
                """, orgId, me, me);
        if (teams.isEmpty()) return List.of();
        List<AssignableItem> open = workItems(orgId, auth, null, null, null).stream()
                .filter(i -> !"DONE".equals(i.item().state()) && i.item().assignee() != null).toList();
        List<TeamWork> result = new ArrayList<>();
        for (Map<String, Object> team : teams) {
            UUID teamId = (UUID) team.get("id");
            UUID lead = (UUID) team.get("lead_membership_id");
            Map<UUID, String> people = new LinkedHashMap<>();
            if (lead != null) people.put(lead, (String) team.get("lead_email"));
            jdbc.query("""
                    SELECT m.id, u.email FROM team_members tm JOIN memberships m ON m.id = tm.membership_id AND m.org_id = tm.org_id
                    JOIN users u ON u.id = m.user_id WHERE tm.team_id = ? AND tm.org_id = ? AND m.status = 'ACTIVE' ORDER BY lower(u.email)
                    """, (org.springframework.jdbc.core.RowCallbackHandler) rs -> people.putIfAbsent(rs.getObject(1, UUID.class), rs.getString(2)),
                    teamId, orgId);
            List<MemberWork> members = new ArrayList<>();
            for (Map.Entry<UUID, String> person : people.entrySet()) {
                List<AssignableItem> tasks = open.stream().filter(i -> person.getKey().equals(i.item().assignee().membershipId())).toList();
                BigDecimal points = tasks.stream().map(i -> i.item().points()).reduce(BigDecimal.ZERO, BigDecimal::add);
                members.add(new MemberWork(person.getKey(), person.getValue(), person.getKey().equals(lead), tasks.size(), points, tasks));
            }
            result.add(new TeamWork(teamId, (String) team.get("name"), (String) team.get("lead_email"), me.equals(lead), members));
        }
        return result;
    }
}
