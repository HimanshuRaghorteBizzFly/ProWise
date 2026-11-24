package com.prowise.work;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.work.WorkDTOs.AddWorkItemRequest;
import com.prowise.work.WorkDTOs.AssignableItem;
import com.prowise.work.WorkDTOs.AssignmentChange;
import com.prowise.work.WorkDTOs.AssignmentRequest;
import com.prowise.work.WorkDTOs.ConfiguredProject;
import com.prowise.work.WorkDTOs.ConfiguredProjectRequest;
import com.prowise.work.WorkDTOs.Document;
import com.prowise.work.WorkDTOs.PersonRef;
import com.prowise.work.WorkDTOs.UpdateWorkItemRequest;
import com.prowise.work.WorkDTOs.WorkItem;
import com.prowise.work.WorkDTOs.WorkType;
import com.prowise.work.WorkDTOs.WorkTypeRequest;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Task 3.1 routes. Creating a configured project, uploading documents and managing work types need
 * organization-scope project.create; the rest checks the membership here and the project rules in the services.
 */
@RestController
@RequestMapping("/v1/organizations/{orgId}")
public class WorkController {

    private static final String MEMBER = "@permissionService.member(authentication, #orgId)";
    private static final String CREATE = "@permissionService.authorize(authentication, #orgId, 'project.create')";

    private final WorkService work;
    private final WorkTypeService workTypes;
    private final DocumentService documents;

    private final WorkQueryService queries;

    public WorkController(WorkService work, WorkTypeService workTypes, DocumentService documents, WorkQueryService queries) {
        this.queries = queries;
        this.work = work;
        this.workTypes = workTypes;
        this.documents = documents;
    }

    /* ---------------------------------------------------------------- Create Project setup */

    @PostMapping("/projects/configured")
    @PreAuthorize(CREATE)
    ResponseEntity<ConfiguredProject> createConfigured(@PathVariable UUID orgId, Authentication authentication,
            @RequestBody ConfiguredProjectRequest request) {
        return ResponseEntity.status(201).body(work.createConfigured(orgId, authentication, request));
    }

    /** Raw file bytes in the body (no multipart), file name in the query. Linked when the project is created. */
    @PostMapping(value = "/project-documents", consumes = MediaType.ALL_VALUE)
    @PreAuthorize(CREATE)
    ResponseEntity<Document> uploadDocument(@PathVariable UUID orgId, Authentication authentication,
            @RequestParam("file_name") String fileName,
            @RequestHeader(value = HttpHeaders.CONTENT_TYPE, required = false) String contentType,
            HttpServletRequest request) throws IOException {
        byte[] bytes;
        try (InputStream in = request.getInputStream()) {
            bytes = in.readNBytes(DocumentService.MAX_BYTES + 1);
        }
        if (bytes.length > DocumentService.MAX_BYTES) throw DocumentService.tooLarge();
        return ResponseEntity.status(201).body(documents.uploadDraft(orgId, authentication, fileName, contentType, bytes));
    }

    @GetMapping("/projects/{projectId}/documents")
    @PreAuthorize(MEMBER)
    List<Document> listDocuments(@PathVariable UUID orgId, @PathVariable String projectId, Authentication authentication) {
        return documents.list(orgId, projectId, authentication);
    }

    @GetMapping("/projects/{projectId}/documents/{documentId}")
    @PreAuthorize(MEMBER)
    ResponseEntity<byte[]> downloadDocument(@PathVariable UUID orgId, @PathVariable String projectId,
            @PathVariable String documentId, Authentication authentication) {
        DocumentService.Content content = documents.download(orgId, projectId, documentId, authentication);
        MediaType type;
        try {
            type = MediaType.parseMediaType(content.document().fileType());
        } catch (RuntimeException invalid) {
            type = MediaType.APPLICATION_OCTET_STREAM;
        }
        return ResponseEntity.ok().contentType(type)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(content.document().fileName(), StandardCharsets.UTF_8).build().toString())
                .body(content.bytes());
    }

    /* ---------------------------------------------------------------- breakdown */

    @GetMapping("/projects/{projectId}/work-items")
    @PreAuthorize(MEMBER)
    List<WorkItem> list(@PathVariable UUID orgId, @PathVariable String projectId, Authentication authentication) {
        return work.list(orgId, projectId, authentication);
    }

    @PostMapping("/projects/{projectId}/work-items")
    @PreAuthorize(MEMBER)
    ResponseEntity<WorkItem> add(@PathVariable UUID orgId, @PathVariable String projectId, Authentication authentication,
            @RequestBody AddWorkItemRequest request) {
        return ResponseEntity.status(201).body(work.add(orgId, projectId, authentication, request));
    }

    @PatchMapping("/projects/{projectId}/work-items/{itemId}")
    @PreAuthorize(MEMBER)
    WorkItem update(@PathVariable UUID orgId, @PathVariable String projectId, @PathVariable String itemId,
            Authentication authentication, @RequestBody UpdateWorkItemRequest request) {
        return work.update(orgId, projectId, itemId, authentication, request);
    }

    @PostMapping("/projects/{projectId}/work-items/{itemId}/retire")
    @PreAuthorize(MEMBER)
    WorkItem retire(@PathVariable UUID orgId, @PathVariable String projectId, @PathVariable String itemId,
            Authentication authentication, @RequestBody VersionBody body) {
        return work.retire(orgId, projectId, itemId, authentication, body.expectedVersion());
    }

    @PostMapping("/projects/{projectId}/work-items/{itemId}/assignment")
    @PreAuthorize(MEMBER)
    WorkItem assign(@PathVariable UUID orgId, @PathVariable String projectId, @PathVariable String itemId,
            Authentication authentication, @RequestBody AssignmentRequest request) {
        return work.assign(orgId, projectId, itemId, authentication, request);
    }

    @GetMapping("/projects/{projectId}/work-items/{itemId}/assignment-history")
    @PreAuthorize(MEMBER)
    List<AssignmentChange> assignmentHistory(@PathVariable UUID orgId, @PathVariable String projectId,
            @PathVariable String itemId, Authentication authentication) {
        return work.assignmentHistory(orgId, projectId, itemId, authentication);
    }

    @GetMapping("/projects/{projectId}/assignees")
    @PreAuthorize(MEMBER)
    List<PersonRef> assignees(@PathVariable UUID orgId, @PathVariable String projectId, Authentication authentication) {
        return work.assignees(orgId, projectId, authentication);
    }

    /** Task 3.1: tasks of every Structured project the caller may read (filters: project_id, assignee me|none|id, state). */
    @GetMapping("/work-items")
    @PreAuthorize(MEMBER)
    List<AssignableItem> workItems(@PathVariable UUID orgId, Authentication authentication,
            @RequestParam(value = "project_id", required = false) String projectId,
            @RequestParam(value = "assignee", required = false) String assignee,
            @RequestParam(value = "state", required = false) String state) {
        return queries.workItems(orgId, authentication, projectId, assignee, state);
    }

    @GetMapping("/work-items/{itemId}")
    @PreAuthorize(MEMBER)
    AssignableItem workItem(@PathVariable UUID orgId, @PathVariable String itemId, Authentication authentication) {
        return queries.workItem(orgId, itemId, authentication);
    }

    /** Teams the caller leads or belongs to, with each member's open tasks (Team Lead "My team"). */
    @GetMapping("/my-teams")
    @PreAuthorize(MEMBER)
    List<WorkQueryService.TeamWork> myTeams(@PathVariable UUID orgId, Authentication authentication) {
        return queries.myTeams(orgId, authentication);
    }

    @GetMapping("/work-items/assignable")
    @PreAuthorize(MEMBER)
    List<AssignableItem> assignable(@PathVariable UUID orgId, Authentication authentication) {
        return work.assignable(orgId, authentication);
    }

    /* ---------------------------------------------------------------- work types (T19) */

    @GetMapping("/work-types")
    @PreAuthorize(MEMBER)
    List<WorkType> workTypes(@PathVariable UUID orgId, Authentication authentication) {
        return workTypes.list(orgId, authentication);
    }

    @PostMapping("/work-types")
    @PreAuthorize(CREATE)
    ResponseEntity<WorkType> createWorkType(@PathVariable UUID orgId, Authentication authentication,
            @RequestBody WorkTypeRequest request) {
        return ResponseEntity.status(201).body(workTypes.create(orgId, authentication, request));
    }

    @PatchMapping("/work-types/{typeId}")
    @PreAuthorize(CREATE)
    WorkType updateWorkType(@PathVariable UUID orgId, @PathVariable UUID typeId, Authentication authentication,
            @RequestBody WorkTypeRequest request) {
        return workTypes.update(orgId, typeId, authentication, request);
    }

    @PostMapping("/work-types/{typeId}/retire")
    @PreAuthorize(CREATE)
    WorkType retireWorkType(@PathVariable UUID orgId, @PathVariable UUID typeId, Authentication authentication,
            @RequestBody VersionBody body) {
        return workTypes.retire(orgId, typeId, authentication, body.expectedVersion());
    }

    record VersionBody(Long expectedVersion) {}
}
