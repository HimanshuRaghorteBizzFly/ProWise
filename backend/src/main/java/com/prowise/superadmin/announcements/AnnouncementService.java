package com.prowise.superadmin.announcements;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.common.api.ApiException;
import com.prowise.superadmin.audit.AuditService;

@Service
@Transactional
public class AnnouncementService {

    private final AnnouncementRepository repository;
    private final AuditService auditService;
    private final ObjectMapper objectMapper;

    public AnnouncementService(AnnouncementRepository repository, AuditService auditService, ObjectMapper objectMapper) {
        this.repository = repository;
        this.auditService = auditService;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<AnnouncementDTOs.AnnouncementResponse> listAnnouncements(String status, String type, String search) {
        List<AnnouncementEntity> all = repository.findAll();
        if (status != null && !status.equalsIgnoreCase("ALL")) {
            all = all.stream().filter(a -> status.equalsIgnoreCase(a.getStatus())).toList();
        }
        if (type != null && !type.equalsIgnoreCase("ALL")) {
            all = all.stream().filter(a -> type.equalsIgnoreCase(a.getType())).toList();
        }
        if (search != null && !search.trim().isEmpty()) {
            String lower = search.trim().toLowerCase();
            all = all.stream().filter(a ->
                    a.getTitle().toLowerCase().contains(lower) ||
                    a.getMessage().toLowerCase().contains(lower)
            ).toList();
        }
        return all.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public AnnouncementDTOs.AnnouncementResponse getAnnouncement(String id) {
        AnnouncementEntity entity = repository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ANNOUNCEMENT_NOT_FOUND", "Announcement not found: " + id));
        return toResponse(entity);
    }

    public AnnouncementDTOs.AnnouncementResponse createAnnouncement(AnnouncementDTOs.CreateAnnouncementRequest req, String actorEmail) {
        String id = "ann-" + UUID.randomUUID().toString().substring(0, 8);

        AnnouncementEntity entity = new AnnouncementEntity();
        entity.setId(id);
        entity.setTitle(req.title().trim());
        entity.setMessage(req.message().trim());
        entity.setType(req.type().toUpperCase());
        entity.setTargetAudience(req.targetAudience().toUpperCase());
        entity.setTargetPlans(toJson(req.targetPlans()));
        entity.setTargetOrgIds(toJson(req.targetOrgIds()));
        entity.setChannels(toJson(req.channels()));
        entity.setStatus(req.status() != null ? req.status().toUpperCase() : "DRAFT");
        entity.setScheduledFor(req.scheduledFor());
        entity.setExpiresAt(req.expiresAt());
        if ("PUBLISHED".equalsIgnoreCase(req.status())) {
            entity.setPublishedAt(Instant.now());
        }
        entity.setCreatedBy(actorEmail != null ? actorEmail : "Super Admin");
        entity.setCreatedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());

        AnnouncementEntity saved = repository.save(entity);

        auditService.logActivity(
                "COMMUNICATION",
                "CREATE_ANNOUNCEMENT",
                "Created platform announcement: " + saved.getTitle(),
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                saved.getTitle(),
                "INFO"
        );

        return toResponse(saved);
    }

    public AnnouncementDTOs.AnnouncementResponse updateAnnouncement(String id, AnnouncementDTOs.UpdateAnnouncementRequest req, String actorEmail) {
        AnnouncementEntity entity = repository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ANNOUNCEMENT_NOT_FOUND", "Announcement not found: " + id));

        if (req.title() != null) entity.setTitle(req.title().trim());
        if (req.message() != null) entity.setMessage(req.message().trim());
        if (req.type() != null) entity.setType(req.type().toUpperCase());
        if (req.targetAudience() != null) entity.setTargetAudience(req.targetAudience().toUpperCase());
        if (req.targetPlans() != null) entity.setTargetPlans(toJson(req.targetPlans()));
        if (req.targetOrgIds() != null) entity.setTargetOrgIds(toJson(req.targetOrgIds()));
        if (req.channels() != null) entity.setChannels(toJson(req.channels()));
        if (req.status() != null) entity.setStatus(req.status().toUpperCase());
        if (req.scheduledFor() != null) entity.setScheduledFor(req.scheduledFor());
        if (req.expiresAt() != null) entity.setExpiresAt(req.expiresAt());
        entity.setUpdatedAt(Instant.now());

        AnnouncementEntity updated = repository.save(entity);

        auditService.logActivity(
                "COMMUNICATION",
                "UPDATE_ANNOUNCEMENT",
                "Updated announcement: " + updated.getTitle(),
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                updated.getTitle(),
                "INFO"
        );

        return toResponse(updated);
    }

    public AnnouncementDTOs.AnnouncementResponse publishAnnouncement(String id, String actorEmail) {
        AnnouncementEntity entity = repository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ANNOUNCEMENT_NOT_FOUND", "Announcement not found: " + id));

        entity.setStatus("PUBLISHED");
        entity.setPublishedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());
        AnnouncementEntity updated = repository.save(entity);

        auditService.logActivity(
                "COMMUNICATION",
                "PUBLISH_ANNOUNCEMENT",
                "Published platform-wide announcement: " + updated.getTitle(),
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                updated.getTitle(),
                "WARNING"
        );

        return toResponse(updated);
    }

    public AnnouncementDTOs.AnnouncementResponse archiveAnnouncement(String id, String actorEmail) {
        AnnouncementEntity entity = repository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ANNOUNCEMENT_NOT_FOUND", "Announcement not found: " + id));

        entity.setStatus("ARCHIVED");
        entity.setUpdatedAt(Instant.now());
        AnnouncementEntity updated = repository.save(entity);

        auditService.logActivity(
                "COMMUNICATION",
                "ARCHIVE_ANNOUNCEMENT",
                "Archived announcement: " + updated.getTitle(),
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                updated.getTitle(),
                "INFO"
        );

        return toResponse(updated);
    }

    public void deleteAnnouncement(String id, String actorEmail) {
        AnnouncementEntity entity = repository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ANNOUNCEMENT_NOT_FOUND", "Announcement not found: " + id));

        repository.delete(entity);

        auditService.logActivity(
                "COMMUNICATION",
                "DELETE_ANNOUNCEMENT",
                "Deleted announcement: " + entity.getTitle(),
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                entity.getTitle(),
                "WARNING"
        );
    }

    public void bulkDelete(List<String> ids, String actorEmail) {
        List<AnnouncementEntity> list = repository.findAllById(ids);
        repository.deleteAll(list);

        auditService.logActivity(
                "COMMUNICATION",
                "BULK_DELETE_ANNOUNCEMENTS",
                "Bulk deleted " + list.size() + " announcements",
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                list.size() + " announcements",
                "WARNING"
        );
    }

    private AnnouncementDTOs.AnnouncementResponse toResponse(AnnouncementEntity e) {
        List<String> plans = fromJson(e.getTargetPlans());
        List<String> orgIds = fromJson(e.getTargetOrgIds());
        List<String> channels = fromJson(e.getChannels());
        return AnnouncementDTOs.AnnouncementResponse.fromEntity(e, plans, orgIds, channels);
    }

    private List<String> fromJson(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception ex) {
            return List.of();
        }
    }

    private String toJson(List<String> list) {
        if (list == null || list.isEmpty()) return "[]";
        try {
            return objectMapper.writeValueAsString(list);
        } catch (Exception ex) {
            return "[]";
        }
    }
}
