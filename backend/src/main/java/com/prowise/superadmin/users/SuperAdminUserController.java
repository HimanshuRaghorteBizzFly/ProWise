package com.prowise.superadmin.users;

import java.util.List;
import java.util.UUID;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.common.api.ApiException;
import com.prowise.common.api.ErrorCodes;
import com.prowise.identity.AuthPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** Platform user provisioning. Super Admin only; credentials are never returned (decisions 2 to 6). */
@RestController
@RequestMapping({"/api/super-admin/users", "/v1/admin/users", "/api/v1/admin/users"})
@Tag(name = "Super Admin User Management", description = "User provisioning with single-use setup links")
public class SuperAdminUserController {

    private static final String SUPER_ADMIN = "hasAuthority('PLATFORM_SUPER_ADMIN')";

    private final SuperAdminUserService userService;

    public SuperAdminUserController(SuperAdminUserService userService) {
        this.userService = userService;
    }

    @PostMapping
<<<<<<< HEAD
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Create user and automatically send temporary credentials to Gmail")
=======
    @PreAuthorize(SUPER_ADMIN)
    @Operation(summary = "Create a pending account and email its owner a 72-hour setup link")
>>>>>>> b46fd9c (Update ProWise application)
    public ResponseEntity<UserDTOs.UserResponse> createUser(
            @RequestBody UserDTOs.CreateUserRequest request,
            HttpServletRequest httpRequest
    ) {
<<<<<<< HEAD
        AuthPrincipal principal = requirePlatformAdmin(httpRequest);
        UUID actorId = principal.userId();
        String actorEmail = principal.email();
        String ip = extractClientIp(httpRequest);

        UserDTOs.UserResponse response = userService.createUser(request, actorId, actorEmail, ip);
=======
        AuthPrincipal actor = AuthPrincipal.require(httpRequest);
        UserDTOs.UserResponse response = userService.createUser(request, actor.userId(), actor.email(), extractClientIp(httpRequest));
>>>>>>> b46fd9c (Update ProWise application)
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
<<<<<<< HEAD
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
=======
    @PreAuthorize(SUPER_ADMIN)
>>>>>>> b46fd9c (Update ProWise application)
    @Operation(summary = "List users with filters, search, and pagination")
    public ResponseEntity<Page<UserDTOs.UserResponse>> listUsers(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size,
            HttpServletRequest httpRequest
    ) {
        requirePlatformAdmin(httpRequest);
        return ResponseEntity.ok(userService.listUsers(search, role, department, status, organizationId, page, size));
    }

    @GetMapping("/{id}")
<<<<<<< HEAD
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Get user details by ID")
    public ResponseEntity<UserDTOs.UserResponse> getUser(@PathVariable UUID id, HttpServletRequest httpRequest) {
        requirePlatformAdmin(httpRequest);
=======
    @PreAuthorize(SUPER_ADMIN)
    @Operation(summary = "Get user details by ID, including the latest setup email status for pending accounts")
    public ResponseEntity<UserDTOs.UserResponse> getUser(@PathVariable UUID id) {
>>>>>>> b46fd9c (Update ProWise application)
        return ResponseEntity.ok(userService.getUser(id));
    }

    @PutMapping("/{id}")
<<<<<<< HEAD
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Update user details")
=======
    @PreAuthorize(SUPER_ADMIN)
    @Operation(summary = "Update user details (platform roles cannot be assigned)")
>>>>>>> b46fd9c (Update ProWise application)
    public ResponseEntity<UserDTOs.UserResponse> updateUser(
            @PathVariable UUID id,
            @RequestBody UserDTOs.UpdateUserRequest request,
            HttpServletRequest httpRequest
    ) {
<<<<<<< HEAD
        AuthPrincipal principal = requirePlatformAdmin(httpRequest);
        UUID actorId = principal.userId();
        String actorEmail = principal.email();
        String ip = extractClientIp(httpRequest);

        return ResponseEntity.ok(userService.updateUser(id, request, actorId, actorEmail, ip));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Activate or deactivate a user account")
=======
        AuthPrincipal actor = AuthPrincipal.require(httpRequest);
        return ResponseEntity.ok(userService.updateUser(id, request, actor.userId(), actor.email(), extractClientIp(httpRequest)));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize(SUPER_ADMIN)
    @Operation(summary = "Disable or re-enable an account (a pending account activates only through setup)")
>>>>>>> b46fd9c (Update ProWise application)
    public ResponseEntity<Void> updateStatus(
            @PathVariable UUID id,
            @RequestBody UserDTOs.UpdateStatusRequest request,
            HttpServletRequest httpRequest
    ) {
<<<<<<< HEAD
        AuthPrincipal principal = requirePlatformAdmin(httpRequest);
        UUID actorId = principal.userId();
        String actorEmail = principal.email();
        String ip = extractClientIp(httpRequest);

        userService.updateStatus(id, request.status(), actorId, actorEmail, ip);
=======
        AuthPrincipal actor = AuthPrincipal.require(httpRequest);
        userService.updateStatus(id, request.status(), actor.userId(), actor.email(), extractClientIp(httpRequest));
>>>>>>> b46fd9c (Update ProWise application)
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/reset-password")
<<<<<<< HEAD
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Reset user password and deliver temporary credentials via email")
    public ResponseEntity<UserDTOs.ResetPasswordResponse> resetPassword(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        AuthPrincipal principal = requirePlatformAdmin(httpRequest);
        UUID actorId = principal.userId();
        String actorEmail = principal.email();
        String ip = extractClientIp(httpRequest);

        return ResponseEntity.ok(userService.resetPassword(id, actorId, actorEmail, ip));
    }

    @PostMapping("/{id}/resend-invitation")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Resend credentials / invitation email to user")
    public ResponseEntity<UserDTOs.ResetPasswordResponse> resendInvitation(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        AuthPrincipal principal = requirePlatformAdmin(httpRequest);
        UUID actorId = principal.userId();
        String actorEmail = principal.email();
        String ip = extractClientIp(httpRequest);

        return ResponseEntity.ok(userService.resendInvitation(id, actorId, actorEmail, ip));
    }

    @GetMapping("/{id}/login-history")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
=======
    @PreAuthorize(SUPER_ADMIN)
    @Operation(summary = "Email a 30-minute password reset link and sign the account out everywhere")
    public ResponseEntity<UserDTOs.CredentialDeliveryResponse> resetPassword(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        AuthPrincipal actor = AuthPrincipal.require(httpRequest);
        return ResponseEntity.ok(userService.resetPassword(id, actor.userId(), actor.email(), extractClientIp(httpRequest)));
    }

    @PostMapping("/{id}/resend-invitation")
    @PreAuthorize(SUPER_ADMIN)
    @Operation(summary = "Resend the setup link of a pending account; earlier links stop working")
    public ResponseEntity<UserDTOs.CredentialDeliveryResponse> resendInvitation(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        AuthPrincipal actor = AuthPrincipal.require(httpRequest);
        return ResponseEntity.ok(userService.resendInvitation(id, actor.userId(), actor.email(), extractClientIp(httpRequest)));
    }

    @GetMapping("/{id}/login-history")
    @PreAuthorize(SUPER_ADMIN)
>>>>>>> b46fd9c (Update ProWise application)
    @Operation(summary = "Get user account login history")
    public ResponseEntity<List<UserDTOs.LoginHistoryResponse>> getLoginHistory(@PathVariable UUID id, HttpServletRequest httpRequest) {
        requirePlatformAdmin(httpRequest);
        return ResponseEntity.ok(userService.getLoginHistory(id));
    }

    /**
     * Platform Administrator only: an authenticated SUPER_ADMIN user whose token is not bound to any
     * organization (no tenant access through this console). @PreAuthorize already requires the authority;
     * this also refuses org-bound tokens and gives every audited action a real actor.
     */
    private static AuthPrincipal requirePlatformAdmin(HttpServletRequest request) {
        AuthPrincipal principal = AuthPrincipal.current(request);
        if (principal == null || principal.userId() == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED, "Authentication is required.");
        }
        if (principal.organizationId() != null) {
            throw new ApiException(HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN, "You are not allowed to perform this action.");
        }
        return principal;
    }

    private static String extractClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
