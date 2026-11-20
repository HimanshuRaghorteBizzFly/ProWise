package com.prowise.authz;

import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import com.prowise.common.api.RequestIdFilter;
import com.prowise.identity.AuthPrincipal;

/**
 * Restricted, append-only security evidence (AS-07). Rows are written in their own transaction so a
 * denied request that rolls back still leaves its evidence. Only the actor, the attempted reference and
 * a fixed reason are stored: never tokens, request bodies or the foreign object's data.
 */
@Service
public class SecurityEvidenceService {

    public static final String ACCESS_DENIED = "ACCESS_DENIED";
    public static final String SELF_ELEVATION_DENIED = "SELF_ELEVATION_DENIED";
    public static final String PRIVILEGE_ESCALATION_DENIED = "PRIVILEGE_ESCALATION_DENIED";

    private final JdbcTemplate jdbc;
    private final TransactionTemplate requiresNew;

    public SecurityEvidenceService(JdbcTemplate jdbc, PlatformTransactionManager transactionManager) {
        this.jdbc = jdbc;
        this.requiresNew = new TransactionTemplate(transactionManager);
        this.requiresNew.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /** Kept for existing callers: records a denied access with the request's ID. */
    public void recordDenied(
            UUID organizationId,
            AuthPrincipal actor,
            String targetType,
            UUID targetId,
            String reason,
            HttpServletRequest request) {
        record(organizationId, actor, ACCESS_DENIED, targetType, targetId == null ? null : targetId.toString(), reason,
                request == null ? null : RequestIdFilter.currentRequestId(request));
    }

    /** Records a denied attempt against the actor's own organization (the one their token is bound to). */
    public void recordDenied(AuthPrincipal actor, String eventType, String targetType, String targetRef, String reason) {
        if (actor == null || actor.organizationId() == null) {
            return; // nothing to attribute the evidence to; the request was still denied
        }
        record(actor.organizationId(), actor, eventType, targetType, targetRef, reason, currentRequestId());
    }

    private void record(
            UUID organizationId,
            AuthPrincipal actor,
            String eventType,
            String targetType,
            String targetRef,
            String reason,
            String requestId) {
        if (organizationId == null) return;
        UUID targetUuid = parseUuid(targetRef);
        String safeRef = targetRef == null ? null : targetRef.substring(0, Math.min(targetRef.length(), 100));
        requiresNew.executeWithoutResult(status -> jdbc.update("""
                INSERT INTO security_evidence
                    (id, org_id, actor_id, event_type, target_type, target_id, target_ref, request_id, reason)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                UUID.randomUUID(), organizationId, actor == null || actor.isOperator() ? null : actor.userId(),
                eventType, targetType, targetUuid, safeRef, requestId,
                reason.substring(0, Math.min(reason.length(), 200))));
    }

    private static String currentRequestId() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            return RequestIdFilter.currentRequestId(attributes.getRequest());
        }
        return null;
    }

    private static UUID parseUuid(String value) {
        if (value == null) return null;
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }
}
