package com.prowise.project;

import java.util.List;
import java.util.UUID;

import org.springframework.core.io.InputStreamResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.prowise.authz.PermissionService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** Project documents and evidence screenshots (local disk behind FileStorage). */
@RestController
@Tag(name = "Files", description = "Upload, list and download project documents and evidence screenshots")
public class FileController {

    private static final String MEMBER = "@permissionService.tokenOrgMember(authentication)";

    private final FileService files;
    private final PermissionService permissions;

    public FileController(FileService files, PermissionService permissions) {
        this.files = files;
        this.permissions = permissions;
    }

    @PostMapping(path = "/v1/organizations/{orgId}/files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("@permissionService.member(authentication, #orgId)")
    @Operation(summary = "Upload a project document (PDF, Office, text, images; 20 MB) or a screenshot (PNG/JPG/WebP; 5 MB)")
    public FileService.FileView upload(@PathVariable UUID orgId, @RequestParam("kind") String kind,
            @RequestParam(value = "project_id", required = false) String projectId,
            @RequestParam(value = "work_item_id", required = false) String workItemId,
            @RequestPart("file") MultipartFile file, Authentication authentication) {
        return files.upload(orgId, authentication, kind, projectId, workItemId, file);
    }

    @GetMapping("/v1/projects/{projectId}/files")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Documents of a readable project")
    public List<FileService.FileView> projectFiles(@PathVariable String projectId, Authentication authentication) {
        return files.projectFiles(permissions.requireTokenOrganization(authentication), projectId, authentication);
    }

    @GetMapping("/v1/work-items/{workItemId}/files")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Screenshots attached to a readable task")
    public List<FileService.FileView> workItemFiles(@PathVariable String workItemId, Authentication authentication) {
        return files.workItemFiles(permissions.requireTokenOrganization(authentication), workItemId, authentication);
    }

    @GetMapping("/v1/files/{fileId}/content")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Download a file of a readable project (404 for foreign or unreadable files)")
    public ResponseEntity<InputStreamResource> download(@PathVariable String fileId, Authentication authentication) {
        FileService.Download download = files.download(permissions.requireTokenOrganization(authentication), fileId,
                authentication);
        boolean image = download.file().contentType().startsWith("image/");
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(download.file().contentType()))
                .contentLength(download.file().size())
                .header(HttpHeaders.CONTENT_DISPOSITION, (image ? ContentDisposition.inline() : ContentDisposition.attachment())
                        .filename(download.file().name(), java.nio.charset.StandardCharsets.UTF_8).build().toString())
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(new InputStreamResource(download.content()));
    }

    @DeleteMapping("/v1/files/{fileId}")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Discard a staged upload that was never attached to a project (uploader only)")
    public ResponseEntity<Void> discard(@PathVariable String fileId, Authentication authentication) {
        files.deleteStaged(permissions.requireTokenOrganization(authentication), fileId, authentication);
        return ResponseEntity.noContent().build();
    }
}
