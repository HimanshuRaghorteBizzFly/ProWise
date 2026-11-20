package com.prowise.developer;

import java.util.UUID;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import com.prowise.authz.PermissionKey;
import com.prowise.authz.PermissionService;
import com.prowise.authz.SecurityEvidenceService;
import com.prowise.common.api.ApiException;
import com.prowise.identity.AuthPrincipal;

/**
 * Access rules for the developer workspace (task 1.3).
 *
 * <ul>
 *   <li>The organization always comes from the org-bound token, never from a parameter or body.</li>
 *   <li>An object is visible only if it exists in that organization AND the caller holds
 *       {@code project.read} on its project (ORG grant or PROJECT grant for that project).</li>
 *   <li>Invisible = foreign, unknown or private: 404 with no metadata, and restricted evidence is recorded.</li>
 *   <li>Visible but missing the action key or relationship (assignee, reviewer, accountable owner): 403.</li>
 * </ul>
 */
@Component
public class DeveloperAccess {

    private final PermissionService permissions;
    private final SecurityEvidenceService evidence;

    public DeveloperAccess(PermissionService permissions, SecurityEvidenceService evidence) {
        this.permissions = permissions;
        this.evidence = evidence;
    }

    public record Actor(UUID orgId, String userId, Authentication authentication, AuthPrincipal principal) {}

    /** Resolves the caller from the org-bound token after re-checking the active membership. */
    public Actor actor(Authentication authentication) {
        UUID orgId = permissions.requireTokenOrganization(authentication);
        AuthPrincipal principal = permissions.principal(authentication);
        return new Actor(orgId, principal.userId().toString(), authentication, principal);
    }

    public boolean can(Actor actor, String projectId, PermissionKey key) {
        return projectId != null && permissions.canOnProject(actor.authentication(), actor.orgId(), projectId, key.value());
    }

    public boolean canAtOrg(Actor actor, PermissionKey key) {
        return permissions.canOnProject(actor.authentication(), actor.orgId(), null, key.value());
    }

    public boolean canRead(Actor actor, String projectId) {
        return can(actor, projectId, PermissionKey.PROJECT_READ);
    }

    /** The object exists in the caller's organization and its project is readable; otherwise 404 + evidence. */
    public void requireVisible(Actor actor, String targetType, String targetRef, String projectId) {
        if (!canRead(actor, projectId)) {
            throw notFound(actor, targetType, targetRef);
        }
    }

    /** The caller holds {@code key} on the project, else 403 (the object is already known to be visible). */
    public void requireAction(Actor actor, String projectId, PermissionKey key) {
        if (!can(actor, projectId, key)) {
            throw PermissionService.forbidden();
        }
    }

    public void requireAtOrg(Actor actor, PermissionKey key) {
        if (!canAtOrg(actor, key)) {
            throw PermissionService.forbidden();
        }
    }

    /** 404 indistinguishable from "does not exist", with restricted evidence of the attempt. */
    public ApiException notFound(Actor actor, String targetType, String targetRef) {
        evidence.recordDenied(actor.principal(), SecurityEvidenceService.ACCESS_DENIED, targetType, targetRef,
                "Foreign, unknown or unreadable object");
        return PermissionService.notFound();
    }
}
