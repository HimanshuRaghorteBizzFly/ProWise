package com.prowise.operator;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import com.prowise.identity.AuthPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping
@Tag(name = "Platform Operators", description = "Operator lifecycle, department access control, and telemetry")
public class PlatformOperatorController {

    private final OperatorService operatorService;

    public PlatformOperatorController(OperatorService operatorService) {
        this.operatorService = operatorService;
    }

    // 1. List Operators
    @GetMapping({"/v1/operators", "/api/v1/operators", "/v1/admin/operators", "/api/v1/admin/operators"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "List all platform operators with optional department and status filters")
    public List<OperatorDTOs.OperatorResponse> listOperators(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String roleId,
            @RequestParam(required = false) String status
    ) {
        return operatorService.listOperators(search, department, roleId, status);
    }

    // 2. Get Single Operator
    @GetMapping({"/v1/operators/{id}", "/api/v1/operators/{id}", "/v1/admin/operators/{id}", "/api/v1/admin/operators/{id}"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Get single operator details")
    public OperatorDTOs.OperatorResponse getOperator(@PathVariable String id) {
        return operatorService.getOperator(id);
    }

    // 3. Create Operator
    @PostMapping({"/v1/operators", "/api/v1/operators", "/v1/admin/operators", "/api/v1/admin/operators"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Provision a new platform operator")
    public ResponseEntity<OperatorDTOs.OperatorResponse> createOperator(
            @RequestBody OperatorDTOs.CreateOperatorRequest request,
            Authentication authentication
    ) {
        String actor = actorOf(authentication);
        OperatorDTOs.OperatorResponse created = operatorService.createOperator(request, actor);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // 4. Update Operator
    @PatchMapping({"/v1/operators/{id}", "/api/v1/operators/{id}", "/v1/admin/operators/{id}", "/api/v1/admin/operators/{id}"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Update an operator profile or shift assignment")
    public OperatorDTOs.OperatorResponse updateOperator(
            @PathVariable String id,
            @RequestBody OperatorDTOs.UpdateOperatorRequest request,
            Authentication authentication
    ) {
        String actor = actorOf(authentication);
        return operatorService.updateOperator(id, request, actor);
    }

    // 5. Delete Operator (With protection against deleting last super admin)
    @DeleteMapping({"/v1/operators/{id}", "/api/v1/operators/{id}", "/v1/admin/operators/{id}", "/api/v1/admin/operators/{id}"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Delete an operator account")
    public ResponseEntity<Void> deleteOperator(
            @PathVariable String id,
            Authentication authentication
    ) {
        String actor = actorOf(authentication);
        operatorService.deleteOperator(id, actor);
        return ResponseEntity.noContent().build();
    }

    // 6. Toggle or Update Status
    @PostMapping({"/v1/operators/{id}/toggle-status", "/api/v1/operators/{id}/toggle-status", "/v1/admin/operators/{id}/toggle-status", "/api/v1/admin/operators/{id}/toggle-status"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Toggle operator active or suspended status")
    public OperatorDTOs.OperatorResponse toggleStatus(
            @PathVariable String id,
            Authentication authentication
    ) {
        String actor = actorOf(authentication);
        return operatorService.toggleOperatorStatus(id, actor);
    }

    @PatchMapping({"/v1/operators/{id}/status", "/api/v1/operators/{id}/status", "/v1/admin/operators/{id}/status", "/api/v1/admin/operators/{id}/status"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Explicitly set operator status (ACTIVE, INACTIVE, SUSPENDED, INVITED)")
    public OperatorDTOs.OperatorResponse updateStatus(
            @PathVariable String id,
            @RequestBody(required = false) OperatorDTOs.StatusUpdateRequest body,
            Authentication authentication
    ) {
        String actor = actorOf(authentication);
        String status = (body != null) ? body.status() : null;
        return operatorService.updateOperatorStatus(id, status, actor);
    }

    // 6b. Update Access Level
    @PatchMapping({"/v1/operators/{id}/access-level", "/api/v1/operators/{id}/access-level", "/v1/admin/operators/{id}/access-level", "/api/v1/admin/operators/{id}/access-level"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Update operator access level (MAIN_PLATFORM_OPERATOR vs DEPARTMENT_OPERATOR)")
    public OperatorDTOs.OperatorResponse updateAccessLevel(
            @PathVariable String id,
            @RequestBody OperatorDTOs.UpdateAccessLevelRequest body,
            Authentication authentication
    ) {
        String actor = actorOf(authentication);
        return operatorService.updateAccessLevel(id, body != null ? body.accessLevel() : null, actor);
    }

    // 6c. Update Department
    @PatchMapping({"/v1/operators/{id}/department", "/api/v1/operators/{id}/department", "/v1/admin/operators/{id}/department", "/api/v1/admin/operators/{id}/department"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Update operator assigned department")
    public OperatorDTOs.OperatorResponse updateDepartment(
            @PathVariable String id,
            @RequestBody OperatorDTOs.UpdateDepartmentRequest body,
            Authentication authentication
    ) {
        String actor = actorOf(authentication);
        return operatorService.updateDepartment(id, body != null ? body.departmentId() : null, actor);
    }

    // 7. Get Effective Permissions
    @GetMapping({"/v1/operators/{id}/permissions", "/api/v1/operators/{id}/permissions", "/v1/admin/operators/{id}/permissions", "/api/v1/admin/operators/{id}/permissions"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Get resolved effective permissions for an operator")
    public OperatorDTOs.EffectivePermissionsResponse getEffectivePermissions(@PathVariable String id) {
        return operatorService.getEffectivePermissions(id);
    }

    // 8. Update / Override Permissions
    @PutMapping({"/v1/operators/{id}/permissions", "/api/v1/operators/{id}/permissions", "/v1/admin/operators/{id}/permissions", "/api/v1/admin/operators/{id}/permissions"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Set explicit permission overrides for an operator")
    public OperatorDTOs.EffectivePermissionsResponse updatePermissions(
            @PathVariable String id,
            @RequestBody OperatorDTOs.UpdatePermissionsPayload payload,
            Authentication authentication
    ) {
        String actor = actorOf(authentication);
        return operatorService.updatePermissions(id, payload, actor);
    }

    // 9. Revoke Active Sessions
    @PostMapping({"/v1/operators/{id}/revoke-sessions", "/api/v1/operators/{id}/revoke-sessions", "/v1/admin/operators/{id}/revoke-sessions", "/api/v1/admin/operators/{id}/revoke-sessions"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Revoke all active sessions for an operator")
    public ResponseEntity<Void> revokeSessions(
            @PathVariable String id,
            Authentication authentication
    ) {
        String actor = actorOf(authentication);
        operatorService.revokeActiveSessions(id, actor);
        return ResponseEntity.ok().build();
    }

    // 10. Resend Invitation
    @PostMapping({"/v1/operators/{id}/resend-invite", "/api/v1/operators/{id}/resend-invite", "/v1/admin/operators/{id}/resend-invite", "/api/v1/admin/operators/{id}/resend-invite"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Resend invite link to an operator")
    public ResponseEntity<Void> resendInvite(
            @PathVariable String id,
            Authentication authentication
    ) {
        String actor = actorOf(authentication);
        operatorService.resendInvitation(id, actor);
        return ResponseEntity.ok().build();
    }

    // 11. List Departments
    @GetMapping({"/v1/departments", "/api/v1/departments", "/v1/admin/departments", "/api/v1/admin/departments", "/v1/admin/operator-departments", "/api/v1/admin/operator-departments", "/v1/operator-departments", "/api/v1/operator-departments"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "List all platform operator departments")
    public List<OperatorDTOs.DepartmentResponse> listDepartments() {
        return operatorService.listDepartments();
    }

    // 11b. List Operator Roles
    @GetMapping({"/v1/admin/operator-roles", "/api/v1/admin/operator-roles", "/v1/operator-roles", "/api/v1/operator-roles"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "List standard platform operator roles")
    public List<OperatorDTOs.RoleResponse> listRoles() {
        return operatorService.listRoles();
    }

    // 11c. List Operator Permissions Catalog
    @GetMapping({"/v1/admin/operator-permissions", "/api/v1/admin/operator-permissions", "/v1/operator-permissions", "/api/v1/operator-permissions"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "List all platform operator modules and permission actions")
    public List<OperatorDTOs.PermissionCatalogItem> listPermissionsCatalog() {
        return operatorService.listPermissionCatalog();
    }

    // 12. Current Operator Profile
    @GetMapping({"/v1/operator/me", "/api/v1/operator/me"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Get current logged-in operator profile")
    public OperatorDTOs.OperatorResponse getCurrentOperator(Authentication authentication) {
        String email = emailOf(authentication);
        return operatorService.getCurrentOperatorProfile(email);
    }

    // 13. Current Operator Effective Permissions
    @GetMapping({"/v1/operator/me/permissions", "/api/v1/operator/me/permissions"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Get current operator effective permissions")
    public OperatorDTOs.EffectivePermissionsResponse getCurrentOperatorPermissions(Authentication authentication) {
        String email = emailOf(authentication);
        OperatorDTOs.OperatorResponse profile = operatorService.getCurrentOperatorProfile(email);
        return operatorService.getEffectivePermissions(profile.id());
    }

    // 14. Dynamic Navigation Routes by Department
    @GetMapping({"/v1/operator/navigation", "/api/v1/operator/navigation"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Get authorized navigation sidebar sections for logged-in operator")
    public OperatorDTOs.OperatorNavigationResponse getNavigation(Authentication authentication) {
        String email = emailOf(authentication);
        return operatorService.getNavigationRoutes(email);
    }

    // 15. Personalized Department Dashboard Data
    @GetMapping({"/v1/operator/dashboard", "/api/v1/operator/dashboard"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Get personalized department telemetry for operator dashboard")
    public OperatorDTOs.OperatorDashboardResponse getDashboard(Authentication authentication) {
        String email = emailOf(authentication);
        return operatorService.getDashboardSummary(email);
    }

    /** The signed-in email. Authentication#getName() would be the whole principal record (session id included). */
    private static String emailOf(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof AuthPrincipal principal && principal.email() != null) {
            return principal.email();
        }
        return "";
    }

    /** Audit actor: the signed-in email, never the principal's toString. */
    private static String actorOf(Authentication authentication) {
        String email = emailOf(authentication);
        return email.isBlank() ? "Super Admin" : email;
    }
}
