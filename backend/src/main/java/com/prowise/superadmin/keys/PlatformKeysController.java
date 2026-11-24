package com.prowise.superadmin.keys;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Read-only: which server settings are configured. Secret values are never returned, and there is deliberately
 * no route that writes or generates configuration (keys are set on the server and applied by a restart).
 */
@RestController
@RequestMapping({"/v1/admin/platform-keys", "/api/v1/admin/platform-keys", "/api/admin/platform-keys"})
@Tag(name = "Super Admin Platform Keys", description = "Configured / missing status of server-side settings; secret values are never returned")
public class PlatformKeysController {

    private final PlatformKeysService service;

    public PlatformKeysController(PlatformKeysService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "List server settings with configured / missing status; secrets carry no value")
    public PlatformKeysDTOs.PlatformKeysResponse getKeys() {
        return service.getKeys();
    }
}
