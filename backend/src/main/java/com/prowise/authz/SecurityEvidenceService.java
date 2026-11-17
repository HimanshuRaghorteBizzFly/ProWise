package com.prowise.authz;

import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import com.prowise.identity.AuthPrincipal;

@Service
public class SecurityEvidenceService {

    private final JdbcTemplate jdbc;

    public SecurityEvidenceService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void recordDenied(
            UUID organizationId,
            AuthPrincipal actor,
            String targetType,
            UUID targetId,
            String reason,
            HttpServletRequest request) {
        jdbc.update("""
                INSERT INTO security_evidence
                    (id, org_id, actor_id, event_type, target_type, target_id, request_id, reason)
                VALUES (?, ?, ?, 'ACCESS_DENIED', ?, ?, ?, ?)
                """,
                UUID.randomUUID(), organizationId, actor == null ? null : actor.userId(),
                targetType, targetId, request.getHeader("X-Request-Id"), reason);
    }
}
