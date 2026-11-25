package com.prowise.integration.github;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import com.prowise.authz.PermissionKey;
import com.prowise.authz.PermissionService;
import com.prowise.common.api.ApiError;
import com.prowise.common.api.ApiException;
import com.prowise.common.change.ChangeRecorder;
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.project.ProjectService;

/**
 * GitHub for an organization through the Prowise GitHub App (task 4.1).
 *
 * <ol>
 *   <li>An Owner/Admin (organization-wide {@code repo.connect}) starts the install; Prowise stores a one-time state
 *       (hash only, 10 minutes, bound to the user and organization) and sends the browser to GitHub.</li>
 *   <li>GitHub returns to the Prowise callback page with the installation id, the state and an OAuth code. The code
 *       proves the installer's GitHub account can access that installation (so nobody can claim another account's
 *       installation id). One installation belongs to one organization.</li>
 *   <li>Afterwards, whoever holds {@code repo.connect} on a project (creator, its PM, Owner/Admin) picks a repository
 *       and branch from the installation. Prowise validates access, links it, and imports recent commits and pull
 *       requests. The App's webhook delivers new events. Installation tokens are short-lived and never stored.</li>
 * </ol>
 * GitHub activity is evidence only: it never completes tasks or changes progress (rule 9).
 */
@Service
public class GitHubAppService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Pattern RETURN_TO = Pattern.compile("^/org/[A-Za-z0-9-]{1,64}(/[A-Za-z0-9._~-]{1,100}){0,8}/?$");

    private final JdbcTemplate jdbc;
    private final PermissionService permissions;
    private final ProjectService projects;
    private final GitHubAppApi app;
    private final GitHubClient client;
    private final GitHubService github;
    private final ChangeRecorder changes;
    private final TransactionTemplate transactions;

    public GitHubAppService(JdbcTemplate jdbc, PermissionService permissions, ProjectService projects, GitHubAppApi app,
            GitHubClient client, GitHubService github, ChangeRecorder changes, TransactionTemplate transactions) {
        this.jdbc = jdbc;
        this.permissions = permissions;
        this.projects = projects;
        this.app = app;
        this.client = client;
        this.github = github;
        this.changes = changes;
        this.transactions = transactions;
    }

    /* ================================================================== organization: installations */

    @Transactional(readOnly = true)
    public AppStatus status(Authentication authentication, UUID orgId) {
        boolean canManage = permissions.can(authentication, orgId, PermissionKey.REPO_CONNECT.value());
        List<InstallationView> installations = jdbc.query("""
                SELECT i.id, i.installation_id, i.account_login, i.account_type, i.repository_selection, i.status, i.version,
                       i.created_at, u.email AS installed_by,
                       (SELECT count(*) FROM project_repository_links l
                         WHERE l.org_id = i.org_id AND l.installation_ref = i.id AND l.status <> 'DISCONNECTED') AS projects
                FROM github_app_installations i LEFT JOIN users u ON u.id = i.installed_by
                WHERE i.org_id = ? AND i.status <> 'REMOVED'
                ORDER BY i.created_at
                """, (rs, n) -> new InstallationView(rs.getObject("id", UUID.class), rs.getLong("installation_id"),
                rs.getString("account_login"), rs.getString("account_type"), rs.getString("repository_selection"),
                rs.getString("status"), rs.getLong("version"), rs.getTimestamp("created_at").toInstant(),
                rs.getString("installed_by"), rs.getInt("projects"),
                "https://github.com/" + ("Organization".equals(rs.getString("account_type")) ? "organizations/" + rs.getString("account_login") + "/settings/installations/" + rs.getLong("installation_id")
                        : "settings/installations/" + rs.getLong("installation_id"))), orgId);
        return new AppStatus(app.configured(), app.configured() ? app.slug() : null, canManage, installations);
    }

    @Transactional
    public InstallStart startInstall(Authentication authentication, UUID orgId, InstallRequest request) {
        requireOrgManage(authentication, orgId);
        requireConfigured();
        String returnTo = request == null || request.returnTo() == null ? null : request.returnTo().trim();
        if (returnTo != null && (returnTo.isEmpty() || returnTo.length() > 300 || !RETURN_TO.matcher(returnTo).matches()
                || !returnTo.startsWith("/org/" + orgId + "/"))) {
            throw validation("return_to", "must be a page of this organization");
        }
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String state = HexFormat.of().formatHex(bytes);
        jdbc.update("""
                INSERT INTO github_app_install_states (id, org_id, user_id, state_hash, return_to, expires_at)
                VALUES (?, ?, ?, ?, ?, now() + interval '10 minutes')
                """, UUID.randomUUID(), orgId, permissions.principal(authentication).userId(), sha256(state), returnTo);
        return new InstallStart(app.installUrl(state));
    }

    /** The GitHub setup redirect, posted by the Prowise callback page of the signed-in user. */
    @Transactional
    public CallbackResult complete(Authentication authentication, CallbackRequest request) {
        UUID orgId = permissions.requireTokenOrganization(authentication);
        UUID userId = permissions.principal(authentication).userId();
        if (request == null || request.state() == null || request.state().isBlank() || request.state().length() > 200) {
            throw stateInvalid();
        }
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT id, org_id, user_id, return_to, expires_at, used_at FROM github_app_install_states
                WHERE state_hash = ? FOR UPDATE
                """, sha256(request.state().trim()));
        // Foreign organization or another user's state: same answer as an unknown one (no metadata).
        if (rows.isEmpty() || !orgId.equals(rows.get(0).get("org_id")) || !userId.equals(rows.get(0).get("user_id"))) {
            throw stateInvalid();
        }
        Map<String, Object> row = rows.get(0);
        if (row.get("used_at") != null) {
            throw new ApiException(HttpStatus.CONFLICT, "GITHUB_STATE_USED", "This GitHub link was already used. Start again.");
        }
        if (((Timestamp) row.get("expires_at")).toInstant().isBefore(Instant.now())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "GITHUB_STATE_EXPIRED", "This GitHub link expired. Start again.");
        }
        requireOrgManage(authentication, orgId);
        requireConfigured();
        if (request.installationId() == null || request.installationId() <= 0) throw validation("installation_id", "is required");
        if (request.code() == null || request.code().isBlank() || request.code().length() > 200) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "GITHUB_AUTHORIZATION_REQUIRED",
                    "GitHub did not send an authorization. In the GitHub App settings, turn on \"Request user authorization "
                            + "(OAuth) during installation\", then start again.");
        }
        jdbc.update("UPDATE github_app_install_states SET used_at = now() WHERE id = ?", row.get("id"));

        Set<Long> mine;
        GitHubAppApi.Installation installation;
        try {
            mine = app.userInstallationIds(request.code().trim());
            if (!mine.contains(request.installationId())) {
                throw new ApiException(HttpStatus.FORBIDDEN, "GITHUB_INSTALLATION_NOT_YOURS",
                        "Your GitHub account cannot access this installation. Install the app from the account that owns it.");
            }
            installation = app.installation(request.installationId());
        } catch (GitHubClient.GitHubException e) {
            throw gitHubError(e);
        }

        List<Map<String, Object>> existing = jdbc.queryForList(
                "SELECT id, org_id, version FROM github_app_installations WHERE installation_id = ? AND status <> 'REMOVED' FOR UPDATE",
                installation.id());
        if (!existing.isEmpty() && !orgId.equals(existing.get(0).get("org_id"))) {
            throw new ApiException(HttpStatus.CONFLICT, "GITHUB_INSTALLATION_IN_USE",
                    "This GitHub account is already connected to another Prowise organization.");
        }
        String status = installation.suspended() ? "SUSPENDED" : "ACTIVE";
        String accountType = switch (installation.accountType()) {
            case "Organization", "Enterprise" -> installation.accountType();
            default -> "User";
        };
        UUID id;
        String action;
        if (existing.isEmpty()) {
            id = UUID.randomUUID();
            jdbc.update("""
                    INSERT INTO github_app_installations (id, org_id, installation_id, account_login, account_type,
                        repository_selection, status, installed_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, id, orgId, installation.id(), clip(installation.accountLogin(), 100), accountType,
                    clip(installation.repositorySelection(), 10), status, userId);
            action = "github.installation_connected";
        } else {
            id = (UUID) existing.get(0).get("id");
            jdbc.update("""
                    UPDATE github_app_installations SET account_login = ?, account_type = ?, repository_selection = ?, status = ?,
                        version = version + 1, updated_at = now()
                    WHERE id = ? AND org_id = ?
                    """, clip(installation.accountLogin(), 100), accountType, clip(installation.repositorySelection(), 10),
                    status, id, orgId);
            action = "github.installation_updated";
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("installation_id", installation.id());
        data.put("account", installation.accountLogin());
        data.put("account_type", accountType);
        data.put("status", status);
        changes.record(new ChangeRecorder.AuditEntry(orgId, userId, action, "GITHUB_INSTALLATION", id, null, null, data),
                new ChangeRecorder.DomainEvent(orgId, "GITHUB_INSTALLATION", id, 0L,
                        existing.isEmpty() ? "GitHubInstallationConnected" : "GitHubInstallationUpdated", data));
        return new CallbackResult(id, installation.accountLogin(), status, (String) row.get("return_to"));
    }

    /**
     * Removes the installation from Prowise: its project links are disconnected (history stays). The App itself is
     * uninstalled on GitHub by the account owner.
     */
    @Transactional
    public void remove(Authentication authentication, UUID orgId, UUID installationRef, VersionRequest request) {
        requireOrgManage(authentication, orgId);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, version, account_login FROM github_app_installations WHERE id = ? AND org_id = ? AND status <> 'REMOVED' FOR UPDATE",
                installationRef, orgId);
        if (rows.isEmpty()) throw PermissionService.notFound();
        if (request == null || request.expectedVersion() == null) throw validation("expected_version", "is required");
        ExpectedVersion.check(((Number) rows.get(0).get("version")).longValue(), request.expectedVersion());
        UUID actor = permissions.principal(authentication).userId();
        List<String> affected = jdbc.queryForList("""
                SELECT project_id FROM project_repository_links
                WHERE org_id = ? AND installation_ref = ? AND status <> 'DISCONNECTED'
                """, String.class, orgId, installationRef);
        jdbc.update("""
                UPDATE project_repository_links SET status = 'DISCONNECTED', version = version + 1, updated_at = now()
                WHERE org_id = ? AND installation_ref = ? AND status <> 'DISCONNECTED'
                """, orgId, installationRef);
        ExpectedVersion.requireUpdated(jdbc.update("""
                UPDATE github_app_installations SET status = 'REMOVED', version = version + 1, updated_at = now()
                WHERE id = ? AND org_id = ? AND version = ?
                """, installationRef, orgId, request.expectedVersion()));
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("account", rows.get(0).get("account_login"));
        data.put("projects_disconnected", affected.size());
        changes.record(new ChangeRecorder.AuditEntry(orgId, actor, "github.installation_removed", "GITHUB_INSTALLATION",
                installationRef, null, null, data), new ChangeRecorder.DomainEvent(orgId, "GITHUB_INSTALLATION",
                installationRef, request.expectedVersion() + 1, "GitHubInstallationRemoved", data));
        for (String projectId : affected) {
            Map<String, Object> event = Map.of("project_id", projectId, "reason", "installation_removed");
            changes.record(new ChangeRecorder.AuditEntry(orgId, actor, "repository.disconnected", "PROJECT",
                    UUID.fromString(projectId), "GitHub installation removed", null, event),
                    new ChangeRecorder.DomainEvent(orgId, "PROJECT", UUID.fromString(projectId), 0L, "RepositoryDisconnected", event));
        }
    }

    /* ================================================================== project: repository choice */

    public List<RepositoryChoice> projectRepositories(Authentication authentication, String projectId, UUID installationRef) {
        ProjectContext context = projectContext(authentication, projectId);
        return repositories(context.orgId(), installationRef, context.projectId());
    }

    public List<String> projectBranches(Authentication authentication, String projectId, UUID installationRef, String repository) {
        ProjectContext context = projectContext(authentication, projectId);
        return branches(context.orgId(), installationRef, repository);
    }

    public Validation projectValidate(Authentication authentication, String projectId, ChoiceRequest request) {
        ProjectContext context = projectContext(authentication, projectId);
        return validate(context.orgId(), request, context.projectId());
    }

    /**
     * Connects (or changes) the project's repository through the App: validated against GitHub first, then link +
     * audit + outbox in one transaction, then recent commits and pull requests are imported (outside it).
     */
    public ConnectResult connectProject(Authentication authentication, String projectId, ChoiceRequest request) {
        ProjectContext context = projectContext(authentication, projectId);
        Validation validation = requireValid(validate(context.orgId(), request, context.projectId()));
        UUID actor = permissions.principal(authentication).userId();
        transactions.executeWithoutResult(status -> github.connectAppLink(context.orgId(), actor, context.projectId(),
                context.version(), new GitHubService.AppLink(validation.repository(), validation.branch(),
                        request.installationId(), validation.privateRepository()), request.expectedVersion(), null));
        GitHubService.SyncResult imported = github.importRecent(context.orgId(), context.projectId(), actor);
        return new ConnectResult(github.view(authentication, context.projectId()), imported);
    }

    /* ---- shared by projects and Create Project drafts (the caller has checked who may pick) */

    public List<RepositoryChoice> repositories(UUID orgId, UUID installationRef, String projectId) {
        InstallationRow installation = activeInstallation(orgId, installationRef);
        List<GitHubAppApi.RepositoryOption> options;
        try {
            options = app.repositories(app.installationToken(installation.installationId()), 300);
        } catch (GitHubClient.GitHubException e) {
            throw gitHubError(e);
        }
        Map<String, String> used = new LinkedHashMap<>();
        jdbc.query("""
                SELECT lower(l.repo_name) AS repo, l.project_id, p.name FROM project_repository_links l
                JOIN projects p ON p.id = l.project_id AND p.org_id = l.org_id
                WHERE l.org_id = ? AND l.provider <> 'LEGACY' AND l.status <> 'DISCONNECTED'
                """, rs -> {
                    if (!rs.getString("project_id").equals(projectId)) used.put(rs.getString("repo"), rs.getString("name"));
                }, orgId);
        List<RepositoryChoice> result = new ArrayList<>();
        for (GitHubAppApi.RepositoryOption option : options == null ? List.<GitHubAppApi.RepositoryOption>of() : options) {
            result.add(new RepositoryChoice(option.fullName(), option.defaultBranch(), option.privateRepository(),
                    option.description(), used.get(option.fullName().toLowerCase(Locale.ROOT))));
        }
        return result;
    }

    public List<String> branches(UUID orgId, UUID installationRef, String repository) {
        InstallationRow installation = activeInstallation(orgId, installationRef);
        String[] parts = parts(repository);
        try {
            List<String> branches = client.branches(app.installationToken(installation.installationId()), parts[0], parts[1], 100);
            return branches == null ? List.of() : branches;
        } catch (GitHubClient.GitHubException e) {
            throw gitHubError(e);
        }
    }

    /** The confirmation screen: every check with its result. Throws only when GitHub cannot be asked at all. */
    public Validation validate(UUID orgId, ChoiceRequest request, String projectId) {
        if (request == null || request.installationId() == null) throw validation("installation_id", "is required");
        InstallationRow installation = activeInstallation(orgId, request.installationId());
        String[] parts = parts(request.repository());
        GitHubAppApi.Installation details;
        GitHubClient.Repository repo;
        GitHubClient.Credential credential;
        try {
            details = app.installation(installation.installationId());
            credential = app.installationToken(installation.installationId());
            repo = client.repository(credential, parts[0], parts[1]);
        } catch (GitHubClient.GitHubException e) {
            if (e.status() == 404 || e.status() == 403) {
                throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "GITHUB_REPO_NOT_FOUND",
                        "The GitHub App cannot see this repository. Add it to the installation on GitHub, then try again.",
                        List.of(new ApiError.FieldError("repository", "not accessible to the GitHub App")));
            }
            throw gitHubError(e);
        }
        String branch = request.branch() == null || request.branch().isBlank() ? repo.defaultBranch() : request.branch().trim();
        boolean branchExists;
        try {
            branchExists = branch.length() <= 100 && client.branchExists(credential, parts[0], parts[1], branch);
        } catch (GitHubClient.GitHubException e) {
            if (e.status() != 400) throw gitHubError(e);
            branchExists = false;
        }
        String usedBy = jdbc.queryForList("""
                SELECT p.name FROM project_repository_links l JOIN projects p ON p.id = l.project_id AND p.org_id = l.org_id
                WHERE l.org_id = ? AND lower(l.repo_name) = lower(?) AND l.provider <> 'LEGACY' AND l.status <> 'DISCONNECTED'
                  AND (CAST(? AS varchar) IS NULL OR l.project_id <> ?)
                """, String.class, orgId, repo.fullName(), projectId, projectId).stream().findFirst().orElse(null);
        Map<String, String> granted = details.permissions() == null ? Map.of() : details.permissions();
        List<String> events = details.events() == null ? List.of() : details.events();
        boolean contents = "read".equals(granted.get("contents")) || "write".equals(granted.get("contents"));
        boolean pulls = "read".equals(granted.get("pull_requests")) || "write".equals(granted.get("pull_requests"));
        boolean webhook = events.contains("push") && events.contains("pull_request");
        List<Check> checks = List.of(
                new Check("repository_access", "Repository access", true, "The GitHub App can read " + repo.fullName() + ".", true),
                new Check("branch", "Branch " + branch, branchExists,
                        branchExists ? "Commits are imported from this branch." : "This branch does not exist in the repository.", true),
                new Check("commits", "Commits (contents: read)", contents,
                        contents ? "Commits can be imported." : "Give the GitHub App read access to repository contents.", true),
                new Check("pull_requests", "Pull requests (pull_requests: read)", pulls,
                        pulls ? "Pull requests can be imported." : "Pull requests will not be imported until the App can read them.", false),
                new Check("webhook", "Live updates (push and pull_request events)", webhook,
                        webhook ? "New commits and pull requests arrive automatically."
                                : "Subscribe the GitHub App to push and pull_request events for live updates; Sync still works.", false),
                new Check("not_in_use", "Not used by another project", usedBy == null,
                        usedBy == null ? "Each project has its own repository." : "Already connected to \"" + usedBy + "\".", true));
        boolean ok = checks.stream().allMatch(c -> c.ok() || !c.required());
        return new Validation(ok, repo.fullName(), "https://github.com/" + repo.fullName(), repo.privateRepository(),
                repo.defaultBranch(), branch, installation.accountLogin(), request.installationId(), checks);
    }

    /** 422 with the first failed required check, for connect / save. */
    public static Validation requireValid(Validation validation) {
        if (validation.ok()) return validation;
        Check failed = validation.checks().stream().filter(c -> !c.ok() && c.required()).findFirst().orElseThrow();
        if ("not_in_use".equals(failed.key())) {
            throw new ApiException(HttpStatus.CONFLICT, "REPOSITORY_IN_USE", failed.detail(),
                    List.of(new ApiError.FieldError("repository", "is connected to another project")));
        }
        String code = "branch".equals(failed.key()) ? "GITHUB_BRANCH_NOT_FOUND" : "GITHUB_NO_ACCESS";
        throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, code, failed.detail(),
                List.of(new ApiError.FieldError("branch".equals(failed.key()) ? "branch" : "repository", failed.detail())));
    }

    /* ================================================================== webhook (installation events) */

    /** installation: deleted / suspend / unsuspend. installation_repositories: removed / added. */
    void installationEvent(String type, com.fasterxml.jackson.databind.JsonNode payload) {
        long installationId = payload.path("installation").path("id").asLong(0);
        if (installationId <= 0) return;
        String action = payload.path("action").asText("");
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, org_id FROM github_app_installations WHERE installation_id = ? AND status <> 'REMOVED'", installationId);
        if (rows.isEmpty()) return;
        UUID id = (UUID) rows.get(0).get("id");
        UUID orgId = (UUID) rows.get(0).get("org_id");
        if ("installation".equals(type)) {
            String status = switch (action) {
                case "deleted" -> "REMOVED";
                case "suspend" -> "SUSPENDED";
                case "unsuspend" -> "ACTIVE";
                default -> null;
            };
            if (status == null) return;
            jdbc.update("UPDATE github_app_installations SET status = ?, version = version + 1, updated_at = now() WHERE id = ?",
                    status, id);
            if ("REMOVED".equals(status)) {
                jdbc.update("""
                        UPDATE project_repository_links SET status = 'ERROR', last_error = ?, version = version + 1, updated_at = now()
                        WHERE org_id = ? AND installation_ref = ? AND status = 'ACTIVE'
                        """, "The GitHub App was uninstalled on GitHub. An admin can connect GitHub again.", orgId, id);
            }
            Map<String, Object> data = Map.of("installation_id", installationId, "status", status);
            changes.record(new ChangeRecorder.AuditEntry(orgId, null, "github.installation_" + status.toLowerCase(Locale.ROOT),
                    "GITHUB_INSTALLATION", id, "GitHub webhook", null, data),
                    new ChangeRecorder.DomainEvent(orgId, "GITHUB_INSTALLATION", id, 0L, "GitHubInstallationStatusChanged", data));
            return;
        }
        if ("installation_repositories".equals(type)) {
            boolean removed = "removed".equals(action);
            var list = payload.path(removed ? "repositories_removed" : "repositories_added");
            for (var repo : list) {
                String fullName = repo.path("full_name").asText("");
                if (fullName.isEmpty()) continue;
                int changed = removed
                        ? jdbc.update("""
                                UPDATE project_repository_links SET status = 'ERROR', last_error = ?, version = version + 1, updated_at = now()
                                WHERE org_id = ? AND installation_ref = ? AND lower(repo_name) = lower(?) AND status = 'ACTIVE'
                                """, "The repository was removed from the GitHub App installation.", orgId, id, fullName)
                        : jdbc.update("""
                                UPDATE project_repository_links SET status = 'ACTIVE', last_error = NULL, version = version + 1, updated_at = now()
                                WHERE org_id = ? AND installation_ref = ? AND lower(repo_name) = lower(?) AND status = 'ERROR'
                                """, orgId, id, fullName);
                if (changed > 0) {
                    Map<String, Object> data = Map.of("repository", fullName, "access", removed ? "removed" : "restored");
                    changes.record(new ChangeRecorder.AuditEntry(orgId, null, "repository.access_changed", "GITHUB_INSTALLATION",
                            id, "GitHub webhook", null, data), new ChangeRecorder.DomainEvent(orgId, "GITHUB_INSTALLATION", id,
                            0L, "RepositoryAccessChanged", data));
                }
            }
        }
    }

    /* ================================================================== helpers */

    private record ProjectContext(UUID orgId, String projectId, long version) {}

    private ProjectContext projectContext(Authentication authentication, String projectId) {
        UUID orgId = permissions.requireTokenOrganization(authentication);
        ProjectService.ProjectResponse project = projects.get(orgId, projectId, authentication);
        if (!permissions.canOnProject(authentication, orgId, project.id(), PermissionKey.REPO_CONNECT.value())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "REPO_CONNECT_REQUIRED",
                    "Connecting a repository needs the repo.connect permission on this project.");
        }
        return new ProjectContext(orgId, project.id(), project.version());
    }

    public record InstallationRow(UUID id, long installationId, String accountLogin, String status) {}

    /** The organization's live installation (else 404); suspended ones cannot be used. */
    public InstallationRow activeInstallation(UUID orgId, UUID installationRef) {
        if (installationRef == null) throw validation("installation_id", "is required");
        List<InstallationRow> rows = jdbc.query("""
                SELECT id, installation_id, account_login, status FROM github_app_installations
                WHERE id = ? AND org_id = ? AND status <> 'REMOVED'
                """, (rs, n) -> new InstallationRow(rs.getObject("id", UUID.class), rs.getLong("installation_id"),
                rs.getString("account_login"), rs.getString("status")), installationRef, orgId);
        if (rows.isEmpty()) throw PermissionService.notFound();
        if (!"ACTIVE".equals(rows.get(0).status())) {
            throw new ApiException(HttpStatus.CONFLICT, "GITHUB_INSTALLATION_SUSPENDED",
                    "The GitHub App installation for " + rows.get(0).accountLogin() + " is suspended on GitHub.");
        }
        return rows.get(0);
    }

    private void requireOrgManage(Authentication authentication, UUID orgId) {
        if (!permissions.can(authentication, orgId, PermissionKey.REPO_CONNECT.value())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "REPO_CONNECT_REQUIRED",
                    "Connecting GitHub for the organization needs organization-wide repo.connect (Owner or Admin).");
        }
    }

    private void requireConfigured() {
        if (!app.configured()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "GITHUB_APP_NOT_CONFIGURED",
                    "The Prowise GitHub App is not configured on this server. Set the GITHUB_APP_* settings.");
        }
    }

    static ApiException gitHubError(GitHubClient.GitHubException e) {
        String code = switch (e.status()) {
            case 401 -> "GITHUB_AUTH_FAILED";
            case 403 -> "GITHUB_NO_ACCESS";
            case 404 -> "GITHUB_NOT_FOUND";
            case 429 -> "GITHUB_RATE_LIMITED";
            case 400 -> "VALIDATION_FAILED";
            case 503 -> e.getMessage() != null && e.getMessage().contains("configured") ? "GITHUB_APP_NOT_CONFIGURED" : "GITHUB_UNAVAILABLE";
            default -> "GITHUB_UNAVAILABLE";
        };
        HttpStatus status = e.status() == 429 ? HttpStatus.TOO_MANY_REQUESTS
                : e.status() == 503 ? HttpStatus.SERVICE_UNAVAILABLE
                : e.status() >= 500 ? HttpStatus.BAD_GATEWAY : HttpStatus.UNPROCESSABLE_ENTITY;
        return new ApiException(status, code, e.getMessage());
    }

    private static String[] parts(String repository) {
        String repo = repository == null ? "" : repository.trim();
        String[] parts = repo.split("/");
        if (parts.length != 2 || !TokenGitHubClient.NAME.matcher(parts[0]).matches()
                || !TokenGitHubClient.NAME.matcher(parts[1]).matches()) {
            throw validation("repository", "use owner/name, for example acme/web");
        }
        return parts;
    }

    private static ApiException stateInvalid() {
        return new ApiException(HttpStatus.BAD_REQUEST, "GITHUB_STATE_INVALID",
                "This GitHub link is not valid for you. Start connecting GitHub again from Prowise.");
    }

    static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String clip(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static ApiException validation(String field, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "The request has invalid fields.",
                List.of(new ApiError.FieldError(field, message)));
    }

    /* ================================================================== records */

    public record AppStatus(boolean configured, String appSlug, boolean canManage, List<InstallationView> installations) {}

    public record InstallationView(UUID id, long githubInstallationId, String account, String accountType,
            String repositorySelection, String status, long version, Instant connectedAt, String connectedBy,
            int projectCount, String manageUrl) {}

    public record InstallRequest(String returnTo) {}

    public record InstallStart(String installUrl) {}

    public record CallbackRequest(String state, Long installationId, String code, String setupAction) {}

    public record CallbackResult(UUID installationId, String account, String status, String returnTo) {}

    public record VersionRequest(Long expectedVersion) {}

    public record RepositoryChoice(String fullName, String defaultBranch, boolean privateRepository, String description,
            /** Name of another project of this organization that already uses it, else null. */
            String usedByProject) {}

    public record ChoiceRequest(UUID installationId, String repository, String branch, Long expectedVersion) {}

    public record Check(String key, String label, boolean ok, String detail, boolean required) {}

    public record Validation(boolean ok, String repository, String repositoryUrl, boolean privateRepository,
            String defaultBranch, String branch, String account, UUID installationId, List<Check> checks) {}

    public record ConnectResult(GitHubService.ConnectionView connection, GitHubService.SyncResult imported) {}
}
