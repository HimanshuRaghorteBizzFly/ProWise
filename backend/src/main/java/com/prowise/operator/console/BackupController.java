package com.prowise.operator.console;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.common.api.ClientAddress;
import com.prowise.identity.AuthPrincipal;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@Tag(name = "Platform Operator Backups", description = "pg_dump database backups")
public class BackupController {

    private static final String OPERATOR = "hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')";

    private final BackupService service;

    public BackupController(BackupService service) {
        this.service = service;
    }

    @GetMapping("/v1/operator/backups")
    @PreAuthorize(OPERATOR)
    @Operation(summary = "Backup runs, newest first, with configured/running flags (system.backups:view)")
    public BackupDTOs.BackupList list(@RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size, HttpServletRequest request) {
        return service.list(AuthPrincipal.require(request), page, size);
    }

    @PostMapping("/v1/operator/backups")
    @PreAuthorize(OPERATOR)
    @Operation(summary = "Run a backup now (system.backups:execute): 202 RUNNING; 503 BACKUP_NOT_CONFIGURED; 409 BACKUP_RUNNING")
    public ResponseEntity<BackupDTOs.BackupRun> run(HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(service.start(AuthPrincipal.require(request), ClientAddress.of(request)));
    }
}
