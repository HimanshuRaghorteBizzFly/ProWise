package com.prowise.work;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.PermissionKey;
import com.prowise.authz.PermissionService;
import com.prowise.common.api.ApiError;
import com.prowise.common.api.ApiException;
import com.prowise.common.change.ChangeRecorder;
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.integration.github.GitHubAppService;
import com.prowise.integration.github.GitHubService;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import com.prowise.project.FileService;

/**
 * Create Project, step by step. Step 1 (basics) saves a DRAFT visible only to its creator (separate table: never in
 * project lists, counts or progress). Documents (staged uploads), phases and tasks, the GitHub repository, people and
 * approvers attach to the draft; each save is validated, guarded by expected_version and audited. "Create project"
 * activates the draft: the project is created by the guided setup ({@link ProjectSetupService}, which re-validates
 * everything: dates, points total at most 100, dependencies, assignees, approvers) and the verified repository is
 * connected, all in ONE transaction with audit rows and outbox events. Unknown, foreign or other people's drafts = 404.
 */
@Service
public class ProjectDraftService {

    private static final Pattern KEY = Pattern.compile("^[A-Z][A-Z0-9]{1,9}$");

    private final JdbcTemplate jdbc;
    private final PermissionService permissions;
    private final ProjectSetupService setup;
    private final ProjectApprovers approvers;
    private final FileService files;
    private final GitHubService github;
    private final GitHubAppService githubApp;
    private final ChangeRecorder changes;
    private final ObjectMapper objectMapper;

    public ProjectDraftService(JdbcTemplate jdbc, PermissionService permissions, ProjectSetupService setup,
            ProjectApprovers approvers, FileService files, GitHubService github, GitHubAppService githubApp,
            ChangeRecorder changes, ObjectMapper objectMapper) {
        this.githubApp = githubApp;
        this.jdbc = jdbc;
        this.permissions = permissions;
        this.setup = setup;
        this.approvers = approvers;
        this.files = files;
        this.github = github;
        this.changes = changes;
        this.objectMapper = objectMapper;
    }

    /* ================================================================== create, list, read */

    @Transactional
    public DraftView create(UUID orgId, Authentication authentication, BasicsRequest request) {
        permissions.require(authentication, orgId, PermissionKey.PROJECT_CREATE.value());
        UUID actor = permissions.principal(authentication).userId();
        Basics basics = basics(orgId, request);
        ProjectSetupService.SetupRequest payload = new ProjectSetupService.SetupRequest(basics.name(), basics.key(),
                basics.description(), basics.mode(), basics.startOn(), basics.targetOn(), null, null, null, List.of(), List.of(),
                List.of(), List.of(), List.of(), List.of());
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO project_drafts (id, org_id, created_by, payload) VALUES (?, ?, ?, ?::jsonb)",
                id, orgId, actor, json(payload));
        record(orgId, actor, id, 0L, "project_draft.created", "basics", Map.of("mode", basics.mode()));
        return view(authentication, orgId, find(orgId, actor, id, false));
    }

    @Transactional(readOnly = true)
    public List<DraftSummary> mine(UUID orgId, Authentication authentication) {
        permissions.require(authentication, orgId, PermissionKey.PROJECT_CREATE.value());
        UUID actor = permissions.principal(authentication).userId();
        return jdbc.query("""
                SELECT id, payload ->> 'name' AS name, payload ->> 'key' AS key, payload ->> 'mode' AS mode, updated_at, version
                FROM project_drafts WHERE org_id = ? AND created_by = ? AND status = 'DRAFT' ORDER BY updated_at DESC LIMIT 50
                """, (rs, n) -> new DraftSummary(rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("key"),
                        rs.getString("mode"), rs.getTimestamp("updated_at").toInstant(), rs.getLong("version")), orgId, actor);
    }

    @Transactional(readOnly = true)
    public DraftView get(Authentication authentication, UUID draftId) {
        UUID orgId = permissions.requireTokenOrganization(authentication);
        return view(authentication, orgId, find(orgId, permissions.principal(authentication).userId(), draftId, false));
    }

    /* ================================================================== steps */

    @Transactional
    public DraftView saveBasics(Authentication authentication, UUID draftId, BasicsRequest request) {
        Draft draft = lockedDraft(authentication, draftId, request == null ? null : request.expectedVersion());
        Basics b = basics(draft.orgId(), request);
        ProjectSetupService.SetupRequest p = draft.payload();
        boolean team = ProjectSetupService.team(b.mode());
        // Switching to Solo drops what only Team projects have (phases, tasks, team lead, QA, extra developers).
        ProjectSetupService.SetupRequest next = new ProjectSetupService.SetupRequest(b.name(), b.key(), b.description(), b.mode(),
                b.startOn(), b.targetOn(), p.timezone(), p.priority(), team ? p.teamLeadMembershipId() : null,
                team ? list(p.developerMembershipIds()) : list(p.developerMembershipIds()).stream().limit(1).toList(),
                team ? list(p.qaMembershipIds()) : List.of(), list(p.approverMembershipIds()), list(p.documentFileIds()),
                team ? list(p.phases()) : List.of(), team ? list(p.tasks()) : List.of());
        return save(authentication, draft, next, "basics");
    }

    @Transactional
    public DraftView saveDocuments(Authentication authentication, UUID draftId, DocumentsRequest request) {
        Draft draft = lockedDraft(authentication, draftId, request == null ? null : request.expectedVersion());
        List<UUID> ids = distinct(request.documentFileIds(), "document_file_ids", 50);
        for (UUID id : ids) requireStagedDocument(draft, id);
        ProjectSetupService.SetupRequest p = draft.payload();
        return save(authentication, draft, with(p, null, null, null, null, ids, null, null), "documents");
    }

    @Transactional
    public DraftView savePlan(Authentication authentication, UUID draftId, PlanRequest request) {
        Draft draft = lockedDraft(authentication, draftId, request == null ? null : request.expectedVersion());
        ProjectSetupService.SetupRequest p = draft.payload();
        if (!ProjectSetupService.team(p.mode())) {
            throw new ApiException(HttpStatus.CONFLICT, "SOLO_HAS_NO_TASKS", "Solo projects have no phases and no tasks.");
        }
        List<ProjectSetupService.PhaseInput> phases = list(request.phases());
        List<ProjectSetupService.TaskInput> tasks = list(request.tasks());
        // Same rules as at creation: titles, phases, whole points 1..100, total at most 100, dependencies without loops.
        ProjectSetupService.plan(phases, tasks, list(p.developerMembershipIds()));
        return save(authentication, draft, with(p, null, null, null, null, null, phases, tasks), "plan");
    }

    @Transactional
    public DraftView savePeople(Authentication authentication, UUID draftId, PeopleRequest request) {
        Draft draft = lockedDraft(authentication, draftId, request == null ? null : request.expectedVersion());
        ProjectSetupService.SetupRequest p = draft.payload();
        boolean team = ProjectSetupService.team(p.mode());
        List<UUID> developers = distinct(request.developerMembershipIds(), "developer_membership_ids", 50);
        List<UUID> qa = distinct(request.qaMembershipIds(), "qa_membership_ids", 50);
        UUID lead = request.teamLeadMembershipId();
        if (!team && (lead != null || !qa.isEmpty())) throw validation("team_lead_membership_id", "Solo projects have a developer only");
        if (!team && developers.size() > 1) throw validation("developer_membership_ids", "a Solo project has one developer");
        if (lead != null) approvers.eligibleUser(draft.orgId(), lead, "team_lead_membership_id");
        for (UUID id : developers) approvers.eligibleUser(draft.orgId(), id, "developer_membership_ids");
        for (UUID id : qa) approvers.eligibleUser(draft.orgId(), id, "qa_membership_ids");
        // A task assigned to someone who is no longer a developer goes back to unassigned.
        List<ProjectSetupService.TaskInput> tasks = list(p.tasks()).stream().map(t -> t.assigneeMembershipId() != null
                && !developers.contains(t.assigneeMembershipId())
                ? new ProjectSetupService.TaskInput(t.ref(), t.title(), t.description(), t.phaseRef(), t.points(), t.dependsOnRef(), null)
                : t).toList();
        ProjectSetupService.SetupRequest next = new ProjectSetupService.SetupRequest(p.name(), p.key(), p.description(), p.mode(),
                p.startOn(), p.targetOn(), p.timezone(), p.priority(), lead, developers, qa, list(p.approverMembershipIds()),
                list(p.documentFileIds()), list(p.phases()), tasks);
        return save(authentication, draft, next, "people");
    }

    @Transactional
    public DraftView saveApprovers(Authentication authentication, UUID draftId, ApproversRequest request) {
        Draft draft = lockedDraft(authentication, draftId, request == null ? null : request.expectedVersion());
        List<UUID> ids = distinct(request.approverMembershipIds(), "approver_membership_ids", 20);
        for (UUID id : ids) approvers.eligibleUser(draft.orgId(), id, "approver_membership_ids");
        return save(authentication, draft, with(draft.payload(), null, null, null, ids, null, null, null), "approvers");
    }

    /** Verifies read access with the token, then stores the repository and the ENCRYPTED token on the draft. */
    @Transactional
    public DraftView saveRepository(Authentication authentication, UUID draftId, RepositoryRequest request) {
        Draft draft = lockedDraft(authentication, draftId, request == null ? null : request.expectedVersion());
        UUID actor = permissions.principal(authentication).userId();
        // The draft belongs to the caller (lockedDraft: their own draft, project.create), so they may connect the
        // repository of the project they are creating; activation grants them repo.connect on that project only.
        String repository;
        if (Boolean.TRUE.equals(request.clear())) {
            repository = draft.repoFullName();
            jdbc.update("""
                    UPDATE project_drafts SET repo_full_name = NULL, repo_default_branch = NULL, repo_token_ciphertext = NULL,
                        repo_token_last4 = NULL, repo_installation_ref = NULL, version = version + 1, updated_at = now() WHERE id = ?
                    """, draft.id());
        } else if (request.installationId() != null) {
            // Through the organization's GitHub App: access, branch and "not used by another project" are checked now.
            GitHubAppService.Validation checked = GitHubAppService.requireValid(githubApp.validate(draft.orgId(),
                    new GitHubAppService.ChoiceRequest(request.installationId(), request.repository(), request.branch(), null), null));
            repository = checked.repository();
            jdbc.update("""
                    UPDATE project_drafts SET repo_full_name = ?, repo_default_branch = ?, repo_token_ciphertext = NULL,
                        repo_token_last4 = NULL, repo_installation_ref = ?, version = version + 1, updated_at = now() WHERE id = ?
                    """, checked.repository(), checked.branch(), request.installationId(), draft.id());
        } else {
            GitHubService.VerifiedRepository repo = github.verifyForDraft(request.repository(), request.token());
            repository = repo.fullName();
            jdbc.update("""
                    UPDATE project_drafts SET repo_full_name = ?, repo_default_branch = ?, repo_token_ciphertext = ?,
                        repo_token_last4 = ?, repo_installation_ref = NULL, version = version + 1, updated_at = now() WHERE id = ?
                    """, repo.fullName(), repo.defaultBranch(), repo.tokenCiphertext(), repo.tokenLast4(), draft.id());
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("repository", repository);
        record(draft.orgId(), actor, draft.id(), draft.version() + 1,
                Boolean.TRUE.equals(request.clear()) ? "project_draft.repository_disconnected" : "project_draft.repository_connected",
                "repository", data);
        return view(authentication, draft.orgId(), find(draft.orgId(), actor, draft.id(), false));
    }

    /* ================================================================== discard, activate */

    @Transactional
    public void discard(Authentication authentication, UUID draftId, VersionRequest request) {
        Draft draft = lockedDraft(authentication, draftId, request == null ? null : request.expectedVersion());
        jdbc.update("""
                UPDATE project_drafts SET status = 'DISCARDED', repo_full_name = NULL, repo_default_branch = NULL,
                    repo_token_ciphertext = NULL, repo_token_last4 = NULL, repo_installation_ref = NULL, version = version + 1,
                    updated_at = now() WHERE id = ?
                """, draft.id());
        for (UUID fileId : list(draft.payload().documentFileIds())) {
            try {
                files.deleteStaged(draft.orgId(), fileId.toString(), authentication);
            } catch (ApiException alreadyGone) {
                // a staged document removed earlier: nothing to clean up
            }
        }
        record(draft.orgId(), permissions.principal(authentication).userId(), draft.id(), draft.version() + 1,
                "project_draft.discarded", "discard", Map.of());
    }

    @Transactional
    public ProjectSetupService.SetupResult activate(Authentication authentication, UUID draftId, VersionRequest request) {
        Draft draft = lockedDraft(authentication, draftId, request == null ? null : request.expectedVersion());
        UUID actor = permissions.principal(authentication).userId();
        // The guided setup re-validates every rule and writes project, plan, approvers, documents, audit and outbox.
        ProjectSetupService.SetupResult result = setup.create(draft.orgId(), authentication, draft.payload());
        if (draft.repoFullName() != null) {
            // On the final project: the creator now holds repo.connect for THIS project (project-scoped grant), or
            // organization-wide as Owner/Admin. Checked again here, never assumed.
            if (!permissions.canOnProject(authentication, draft.orgId(), result.project().id(), PermissionKey.REPO_CONNECT.value())) {
                throw new ApiException(HttpStatus.FORBIDDEN, "REPO_CONNECT_REQUIRED",
                        "Connecting a repository needs the repo.connect permission. Remove the repository step or ask an admin.");
            }
            if (draft.repoInstallationRef() != null) {
                // Still live and not taken by another project since the step was saved; linked in this transaction.
                githubApp.activeInstallation(draft.orgId(), draft.repoInstallationRef());
                github.connectAppLink(draft.orgId(), actor, result.project().id(), result.project().version(),
                        new GitHubService.AppLink(draft.repoFullName(), draft.repoDefaultBranch(), draft.repoInstallationRef(),
                                false), null, "Connected while creating the project");
                // Recent commits and pull requests are imported once the project exists (network, outside the transaction).
                String projectId = result.project().id();
                UUID orgId = draft.orgId();
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        try {
                            github.importRecent(orgId, projectId, actor);
                        } catch (RuntimeException ignored) {
                            // The project and its link exist; "Sync now" on the project retries the import.
                        }
                    }
                });
            } else {
                github.connectFromDraft(draft.orgId(), actor, result.project().id(), result.project().version(),
                        draft.repoFullName(), draft.repoDefaultBranch(), draft.repoTokenCiphertext(), draft.repoTokenLast4());
            }
        }
        jdbc.update("""
                UPDATE project_drafts SET status = 'ACTIVATED', project_id = ?, repo_token_ciphertext = NULL, repo_full_name = NULL,
                    repo_default_branch = NULL, repo_token_last4 = NULL, repo_installation_ref = NULL, version = version + 1,
                    updated_at = now() WHERE id = ?
                """, result.project().id(), draft.id());
        record(draft.orgId(), actor, draft.id(), draft.version() + 1, "project_draft.activated", "activate",
                Map.of("project_id", result.project().id()));
        return result;
    }

    /* ================================================================== helpers */

    record Draft(UUID id, UUID orgId, String status, ProjectSetupService.SetupRequest payload, String repoFullName,
            String repoDefaultBranch, String repoTokenCiphertext, String projectId, long version, String repoTokenLast4,
            UUID repoInstallationRef, String repoAccount) {}

    private record Basics(String name, String key, String description, String mode, LocalDate startOn, LocalDate targetOn) {}

    private Draft lockedDraft(Authentication authentication, UUID draftId, Long expectedVersion) {
        UUID orgId = permissions.requireTokenOrganization(authentication);
        permissions.require(authentication, orgId, PermissionKey.PROJECT_CREATE.value());
        if (expectedVersion == null) throw validation("expected_version", "is required");
        Draft draft = find(orgId, permissions.principal(authentication).userId(), draftId, true);
        if (!"DRAFT".equals(draft.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "DRAFT_CLOSED", "This draft was already created or discarded.");
        }
        ExpectedVersion.check(draft.version(), expectedVersion);
        return draft;
    }

    /** The caller's own draft in this organization; anything else is 404 with no metadata. */
    private Draft find(UUID orgId, UUID creator, UUID draftId, boolean lock) {
        List<Draft> rows = jdbc.query("""
                SELECT d.id, d.org_id, d.status, d.payload::text AS payload, d.repo_full_name, d.repo_default_branch,
                       d.repo_token_ciphertext, d.project_id, d.version, d.repo_token_last4, d.repo_installation_ref,
                       (SELECT i.account_login FROM github_app_installations i
                         WHERE i.id = d.repo_installation_ref AND i.org_id = d.org_id) AS repo_account
                FROM project_drafts d WHERE d.id = ? AND d.org_id = ? AND d.created_by = ?""" + (lock ? " FOR UPDATE OF d" : ""),
                (rs, n) -> new Draft(rs.getObject("id", UUID.class), rs.getObject("org_id", UUID.class), rs.getString("status"),
                        read(rs.getString("payload")), rs.getString("repo_full_name"), rs.getString("repo_default_branch"),
                        rs.getString("repo_token_ciphertext"), rs.getString("project_id"), rs.getLong("version"),
                        rs.getString("repo_token_last4"), rs.getObject("repo_installation_ref", UUID.class),
                        rs.getString("repo_account")),
                draftId, orgId, creator);
        if (rows.isEmpty()) throw PermissionService.notFound();
        return rows.get(0);
    }

    private DraftView save(Authentication authentication, Draft draft, ProjectSetupService.SetupRequest next, String step) {
        UUID actor = permissions.principal(authentication).userId();
        jdbc.update("UPDATE project_drafts SET payload = ?::jsonb, version = version + 1, updated_at = now() WHERE id = ?",
                json(next), draft.id());
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("step", step);
        data.put("tasks", list(next.tasks()).size());
        data.put("documents", list(next.documentFileIds()).size());
        record(draft.orgId(), actor, draft.id(), draft.version() + 1, "project_draft.updated", step, data);
        return view(authentication, draft.orgId(), find(draft.orgId(), actor, draft.id(), false));
    }

    private Basics basics(UUID orgId, BasicsRequest request) {
        if (request == null) throw validation("name", "is required");
        String name = request.name() == null ? "" : request.name().trim();
        if (name.isEmpty() || name.length() > 200) throw validation("name", "must be 1 to 200 characters");
        String key = request.key() == null ? "" : request.key().trim().toUpperCase(Locale.ROOT);
        if (!KEY.matcher(key).matches()) throw validation("key", "must be 2 to 10 letters or digits and start with a letter");
        Integer taken = jdbc.queryForObject("SELECT count(*) FROM projects WHERE org_id = ? AND upper(key) = ?", Integer.class, orgId, key);
        if (taken != null && taken > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_PROJECT_KEY", "This project key is already used in the workspace.",
                    List.of(new ApiError.FieldError("key", "is already in use")));
        }
        String mode = ProjectSetupService.team(request.mode()) ? "TEAM" : "SOLO";
        String description = request.description() == null || request.description().isBlank() ? null : request.description().trim();
        if (description != null && description.length() > 5000) throw validation("description", "must be at most 5000 characters");
        String zone = jdbc.queryForObject("SELECT timezone FROM organizations WHERE id = ?", String.class, orgId);
        if (request.startOn() == null) throw validation("start_on", "is required");
        if (request.targetOn() == null) throw validation("target_on", "is required");
        if (request.startOn().isBefore(LocalDate.now(ZoneId.of(zone)))) {
            throw validation("start_on", "cannot be in the past; choose today or a later date");
        }
        if (request.targetOn().isBefore(request.startOn())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DATE_RANGE", "The end date is before the start date.",
                    List.of(new ApiError.FieldError("target_on", "must be on or after the start date")));
        }
        return new Basics(name, key, description, mode, request.startOn(), request.targetOn());
    }

    private void requireStagedDocument(Draft draft, UUID fileId) {
        Integer count = jdbc.queryForObject("""
                SELECT count(*) FROM file_metadata f JOIN project_drafts d ON d.id = ? AND d.created_by = f.uploaded_by_user
                WHERE f.id = ? AND f.org_id = ? AND f.project_id IS NULL AND f.kind = 'PROJECT_DOCUMENT'
                """, Integer.class, draft.id(), fileId.toString(), draft.orgId());
        if (count == null || count != 1) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "FILE_NOT_STAGED", "A document is no longer available. Upload it again.",
                    List.of(new ApiError.FieldError("document_file_ids", "unknown or already used: " + fileId)));
        }
    }

    private DraftView view(Authentication authentication, UUID orgId, Draft d) {
        ProjectSetupService.SetupRequest p = d.payload();
        List<FileService.FileView> documents = new ArrayList<>();
        for (UUID id : list(p.documentFileIds())) {
            documents.addAll(jdbc.query("""
                    SELECT f.id, f.file_name, f.file_size, f.file_type, f.kind, f.created_at FROM file_metadata f
                    WHERE f.id = ? AND f.org_id = ?
                    """, (rs, n) -> new FileService.FileView(rs.getString("id"), rs.getString("file_name"), rs.getLong("file_size"),
                            rs.getString("file_type"), rs.getString("kind"), null, null, null, rs.getTimestamp("created_at").toInstant(),
                            "/v1/files/" + rs.getString("id") + "/content"), id.toString(), orgId));
        }
        return new DraftView(d.id(), d.status(), d.version(), p.name(), p.key(), p.description(), p.mode(), p.startOn(), p.targetOn(),
                documents, list(p.phases()), list(p.tasks()), p.teamLeadMembershipId(), list(p.developerMembershipIds()),
                list(p.qaMembershipIds()), list(p.approverMembershipIds()),
                new RepositoryView(d.repoFullName() != null, d.repoFullName(), d.repoTokenLast4(),
                        d.repoFullName() == null ? null : "https://github.com/" + d.repoFullName(),
                        d.repoFullName() == null ? null : d.repoInstallationRef() != null ? "GITHUB_APP" : "GITHUB_TOKEN",
                        d.repoFullName() == null ? null : d.repoDefaultBranch(), d.repoInstallationRef(), d.repoAccount()),
                // Only the creator ever sees a draft, and the creator may connect the repository of the project they create.
                true, d.projectId());
    }

    private static ProjectSetupService.SetupRequest with(ProjectSetupService.SetupRequest p, UUID lead, List<UUID> developers,
            List<UUID> qa, List<UUID> approverIds, List<UUID> documents, List<ProjectSetupService.PhaseInput> phases,
            List<ProjectSetupService.TaskInput> tasks) {
        return new ProjectSetupService.SetupRequest(p.name(), p.key(), p.description(), p.mode(), p.startOn(), p.targetOn(),
                p.timezone(), p.priority(), lead != null ? lead : p.teamLeadMembershipId(),
                developers != null ? developers : list(p.developerMembershipIds()), qa != null ? qa : list(p.qaMembershipIds()),
                approverIds != null ? approverIds : list(p.approverMembershipIds()),
                documents != null ? documents : list(p.documentFileIds()), phases != null ? phases : list(p.phases()),
                tasks != null ? tasks : list(p.tasks()));
    }

    private void record(UUID orgId, UUID actor, UUID draftId, long version, String action, String step, Map<String, ?> data) {
        Map<String, Object> payload = new LinkedHashMap<>(data);
        payload.put("step", step);
        payload.put("draft_id", draftId.toString());
        changes.record(new ChangeRecorder.AuditEntry(orgId, actor, action, "PROJECT_DRAFT", draftId, null, null, payload),
                new ChangeRecorder.DomainEvent(orgId, "PROJECT_DRAFT", draftId, version,
                        "project_draft.activated".equals(action) ? "ProjectDraftActivated" : "ProjectDraftChanged", payload));
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private ProjectSetupService.SetupRequest read(String value) {
        try {
            return objectMapper.readValue(value, ProjectSetupService.SetupRequest.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Unreadable project draft.");
        }
    }

    private static <T> List<T> list(List<T> value) {
        return value == null ? List.of() : value;
    }

    private static List<UUID> distinct(List<UUID> ids, String field, int max) {
        LinkedHashSet<UUID> set = new LinkedHashSet<>(ids == null ? List.of() : ids);
        set.remove(null);
        if (set.size() > max) throw validation(field, "at most " + max);
        return new ArrayList<>(set);
    }

    private static ApiException validation(String field, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "The request has invalid fields.",
                List.of(new ApiError.FieldError(field, message)));
    }

    /* ================================================================== records */

    public record BasicsRequest(String name, String key, String description, String mode, LocalDate startOn, LocalDate targetOn,
            Long expectedVersion) {}

    public record DocumentsRequest(List<UUID> documentFileIds, Long expectedVersion) {}

    public record PlanRequest(List<ProjectSetupService.PhaseInput> phases, List<ProjectSetupService.TaskInput> tasks,
            Long expectedVersion) {}

    public record PeopleRequest(UUID teamLeadMembershipId, List<UUID> developerMembershipIds, List<UUID> qaMembershipIds,
            Long expectedVersion) {}

    public record ApproversRequest(List<UUID> approverMembershipIds, Long expectedVersion) {}

    /** {@code token} is write-only: it is verified, encrypted and never returned. */
    public record RepositoryRequest(String repository, String token, Boolean clear, Long expectedVersion,
            /** Pick through the organization's GitHub App installation instead of a token (with {@code branch}). */
            UUID installationId, String branch) {}

    public record VersionRequest(Long expectedVersion) {}

    public record RepositoryView(boolean connected, String repository, String tokenLast4, String url, String provider,
            String branch, UUID installationId, String account) {}

    /* ================================================================== repository choice for the draft's creator */

    public List<GitHubAppService.RepositoryChoice> repositories(Authentication authentication, UUID draftId, UUID installationId) {
        Draft draft = openDraft(authentication, draftId);
        return githubApp.repositories(draft.orgId(), installationId, null);
    }

    public List<String> branches(Authentication authentication, UUID draftId, UUID installationId, String repository) {
        Draft draft = openDraft(authentication, draftId);
        return githubApp.branches(draft.orgId(), installationId, repository);
    }

    public GitHubAppService.Validation validateRepository(Authentication authentication, UUID draftId,
            GitHubAppService.ChoiceRequest request) {
        Draft draft = openDraft(authentication, draftId);
        return githubApp.validate(draft.orgId(), request, null);
    }

    /** The caller's own open draft (project.create), else 404 / 409; nothing is locked. */
    private Draft openDraft(Authentication authentication, UUID draftId) {
        UUID orgId = permissions.requireTokenOrganization(authentication);
        permissions.require(authentication, orgId, PermissionKey.PROJECT_CREATE.value());
        Draft draft = find(orgId, permissions.principal(authentication).userId(), draftId, false);
        if (!"DRAFT".equals(draft.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "DRAFT_CLOSED", "This draft was already created or discarded.");
        }
        return draft;
    }

    public record DraftSummary(UUID id, String name, String key, String mode, java.time.Instant updatedAt, long version) {}

    public record DraftView(UUID id, String status, long version, String name, String key, String description, String mode,
            LocalDate startOn, LocalDate targetOn, List<FileService.FileView> documents, List<ProjectSetupService.PhaseInput> phases,
            List<ProjectSetupService.TaskInput> tasks, UUID teamLeadMembershipId, List<UUID> developerMembershipIds,
            List<UUID> qaMembershipIds, List<UUID> approverMembershipIds, RepositoryView repository, boolean canConnectRepository,
            String projectId) {}
}
