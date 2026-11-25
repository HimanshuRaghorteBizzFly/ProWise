package com.prowise.superadmin.announcements;

import java.util.List;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.superadmin.common.AdminRequests;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping({"/v1/admin/announcements", "/api/v1/admin/announcements"})
@Tag(name = "Super Admin Announcements", description = "Broadcast notices. Mutations need expected_version (409 STALE_VERSION when stale) and accept Idempotency-Key.")
public class AnnouncementController {

    private final AnnouncementService announcementService;

    public AnnouncementController(AnnouncementService announcementService) {
        this.announcementService = announcementService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('announcements.manage')")
    @Operation(summary = "List announcements with optional status/type filters")
    public ResponseEntity<List<AnnouncementDTOs.AnnouncementResponse>> listAnnouncements(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String search
    ) {
        return ResponseEntity.ok(announcementService.listAnnouncements(status, type, search));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('announcements.manage')")
    @Operation(summary = "Get single announcement by ID")
    public ResponseEntity<AnnouncementDTOs.AnnouncementResponse> getAnnouncement(@PathVariable String id) {
        return ResponseEntity.ok(announcementService.getAnnouncement(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('announcements.manage')")
    @Operation(summary = "Create a platform broadcast announcement")
    public ResponseEntity<AnnouncementDTOs.AnnouncementResponse> createAnnouncement(
            HttpServletRequest request,
            @Valid @RequestBody AnnouncementDTOs.CreateAnnouncementRequest body
    ) {
        String actor = AdminRequests.actor(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(announcementService.createAnnouncement(body, actor));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('announcements.manage')")
    @Operation(summary = "Update an existing announcement (expected_version required)")
    public ResponseEntity<AnnouncementDTOs.AnnouncementResponse> updateAnnouncement(
            HttpServletRequest request,
            @PathVariable String id,
            @Valid @RequestBody AnnouncementDTOs.UpdateAnnouncementRequest body
    ) {
        String actor = AdminRequests.actor(request);
        return ResponseEntity.ok(announcementService.updateAnnouncement(id, body, actor));
    }

    @PostMapping("/{id}/publish")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('announcements.manage')")
    @Operation(summary = "Publish an announcement to tenants immediately (body: expected_version)")
    public ResponseEntity<AnnouncementDTOs.AnnouncementResponse> publishAnnouncement(
            HttpServletRequest request,
            @PathVariable String id,
            @RequestBody(required = false) AdminRequests.VersionRequest body
    ) {
        String actor = AdminRequests.actor(request);
        return ResponseEntity.ok(announcementService.publishAnnouncement(id, com.prowise.superadmin.common.AdminRequests.expected(body), actor));
    }

    @PostMapping("/{id}/archive")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('announcements.manage')")
    @Operation(summary = "Archive an active announcement (body: expected_version)")
    public ResponseEntity<AnnouncementDTOs.AnnouncementResponse> archiveAnnouncement(
            HttpServletRequest request,
            @PathVariable String id,
            @RequestBody(required = false) AdminRequests.VersionRequest body
    ) {
        String actor = AdminRequests.actor(request);
        return ResponseEntity.ok(announcementService.archiveAnnouncement(id, com.prowise.superadmin.common.AdminRequests.expected(body), actor));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('announcements.manage')")
    @Operation(summary = "Delete an announcement (?expectedVersion= required)")
    public ResponseEntity<Void> deleteAnnouncement(
            HttpServletRequest request,
            @PathVariable String id,
            @RequestParam(required = false) Long expectedVersion
    ) {
        String actor = AdminRequests.actor(request);
        announcementService.deleteAnnouncement(id, expectedVersion, actor);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/bulk-delete")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('announcements.manage')")
    @Operation(summary = "Bulk delete announcements (items: [{id, expected_version}]; all-or-nothing)")
    public ResponseEntity<Void> bulkDelete(
            HttpServletRequest request,
            @Valid @RequestBody AdminRequests.BulkVersionedRequest body
    ) {
        String actor = AdminRequests.actor(request);
        announcementService.bulkDelete(body.items(), actor);
        return ResponseEntity.noContent().build();
    }
}
