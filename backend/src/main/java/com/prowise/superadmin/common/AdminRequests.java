package com.prowise.superadmin.common;

import java.util.List;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import com.prowise.identity.AuthPrincipal;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Shared request shapes and the audit actor for Super Admin mutations (rule 5: expected_version on every
 * update/state change; the audit actor is always the authenticated principal, never a hardcoded address).
 */
public final class AdminRequests {

    private AdminRequests() {}

    /** The signed-in caller's email for audit rows. @PreAuthorize already guarantees a principal; 401 otherwise. */
    public static String actor(HttpServletRequest request) {
        return AuthPrincipal.require(request).email();
    }

    /** expected_version from an optional body (absent body = missing version = 400 after the permission check). */
    public static Long expected(VersionRequest body) {
        return body == null ? null : body.expectedVersion();
    }

    /** Body of a state change that carries nothing but the version the client read. */
    @Schema(name = "VersionRequest")
    public record VersionRequest(
            @Schema(description = "Version the client last read; 409 STALE_VERSION when it no longer matches",
                    requiredMode = Schema.RequiredMode.REQUIRED)
            Long expectedVersion
    ) {}

    /** One record of a bulk operation with the version the client read. */
    @Schema(name = "VersionedId")
    public record VersionedId(
            @NotBlank String id,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Long expectedVersion
    ) {}

    /** Bulk delete: every item carries its own expected version; one stale item refuses the whole batch. */
    @Schema(name = "BulkVersionedRequest")
    public record BulkVersionedRequest(
            @NotEmpty List<@Valid VersionedId> items
    ) {}
}
