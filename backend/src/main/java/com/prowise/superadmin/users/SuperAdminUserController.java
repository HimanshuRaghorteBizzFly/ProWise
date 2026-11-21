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

import com.prowise.identity.AuthPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping({"/api/super-admin/users", "/v1/admin/users", "/api/v1/admin/users"})
@Tag(name = "Super Admin User Management", description = "User provisioning, credential delivery, and governance")
public class SuperAdminUserController {

    private final SuperAdminUserService userService;

    public SuperAdminUserController(SuperAdminUserService userService) {
        this.userService = userService;
    }

    @PostMapping
    @PreAuthorize("permitAll()")
    @Operation(summary = "Create user and automatically send temporary credentials to Gmail")
    public ResponseEntity<UserDTOs.UserResponse> createUser(
            @RequestBody UserDTOs.CreateUserRequest request,
            HttpServletRequest httpRequest
    ) {
        AuthPrincipal principal = AuthPrincipal.current(httpRequest);
        UUID actorId = principal != null ? principal.userId() : null;
        String actorEmail = principal != null ? principal.email() : "superadmin@prowise.com";
        String ip = extractClientIp(httpRequest);

        UserDTOs.UserResponse response = userService.createUser(request, actorId, actorEmail, ip);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    @PreAuthorize("permitAll()")
    @Operation(summary = "List users with filters, search, and pagination")
    public ResponseEntity<Page<UserDTOs.UserResponse>> listUsers(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size
    ) {
        return ResponseEntity.ok(userService.listUsers(search, role, department, status, organizationId, page, size));
    }

    @GetMapping("/{id}")
    @PreAuthorize("permitAll()")
    @Operation(summary = "Get user details by ID")
    public ResponseEntity<UserDTOs.UserResponse> getUser(@PathVariable UUID id) {
        return ResponseEntity.ok(userService.getUser(id));
    }

    @PutMapping("/{id}")
    @PreAuthorize("permitAll()")
    @Operation(summary = "Update user details")
    public ResponseEntity<UserDTOs.UserResponse> updateUser(
            @PathVariable UUID id,
            @RequestBody UserDTOs.UpdateUserRequest request,
            HttpServletRequest httpRequest
    ) {
        AuthPrincipal principal = AuthPrincipal.current(httpRequest);
        UUID actorId = principal != null ? principal.userId() : null;
        String actorEmail = principal != null ? principal.email() : "superadmin@prowise.com";
        String ip = extractClientIp(httpRequest);

        return ResponseEntity.ok(userService.updateUser(id, request, actorId, actorEmail, ip));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("permitAll()")
    @Operation(summary = "Activate or deactivate a user account")
    public ResponseEntity<Void> updateStatus(
            @PathVariable UUID id,
            @RequestBody UserDTOs.UpdateStatusRequest request,
            HttpServletRequest httpRequest
    ) {
        AuthPrincipal principal = AuthPrincipal.current(httpRequest);
        UUID actorId = principal != null ? principal.userId() : null;
        String actorEmail = principal != null ? principal.email() : "superadmin@prowise.com";
        String ip = extractClientIp(httpRequest);

        userService.updateStatus(id, request.status(), actorId, actorEmail, ip);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/reset-password")
    @PreAuthorize("permitAll()")
    @Operation(summary = "Reset user password and deliver temporary credentials via email")
    public ResponseEntity<UserDTOs.ResetPasswordResponse> resetPassword(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        AuthPrincipal principal = AuthPrincipal.current(httpRequest);
        UUID actorId = principal != null ? principal.userId() : null;
        String actorEmail = principal != null ? principal.email() : "superadmin@prowise.com";
        String ip = extractClientIp(httpRequest);

        return ResponseEntity.ok(userService.resetPassword(id, actorId, actorEmail, ip));
    }

    @PostMapping("/{id}/resend-invitation")
    @PreAuthorize("permitAll()")
    @Operation(summary = "Resend credentials / invitation email to user")
    public ResponseEntity<UserDTOs.ResetPasswordResponse> resendInvitation(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        AuthPrincipal principal = AuthPrincipal.current(httpRequest);
        UUID actorId = principal != null ? principal.userId() : null;
        String actorEmail = principal != null ? principal.email() : "superadmin@prowise.com";
        String ip = extractClientIp(httpRequest);

        return ResponseEntity.ok(userService.resendInvitation(id, actorId, actorEmail, ip));
    }

    @GetMapping("/{id}/login-history")
    @PreAuthorize("permitAll()")
    @Operation(summary = "Get user account login history")
    public ResponseEntity<List<UserDTOs.LoginHistoryResponse>> getLoginHistory(@PathVariable UUID id) {
        return ResponseEntity.ok(userService.getLoginHistory(id));
    }

    private static String extractClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
