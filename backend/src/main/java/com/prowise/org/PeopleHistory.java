package com.prowise.org;

import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Task 1.2: append-only membership and ownership history. Rows are written in the caller's transaction,
 * next to the business change, its audit row and its outbox event; the tables reject UPDATE and DELETE.
 */
@Component
public class PeopleHistory {

    private final JdbcTemplate jdbc;

    public PeopleHistory(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void membership(UUID organizationId, UUID membershipId, UUID userId, String changeType,
            String previousStatus, String newStatus, String previousRole, String newRole, UUID actorId, String reason) {
        jdbc.update("""
                INSERT INTO membership_history
                    (id, org_id, membership_id, user_id, change_type, previous_status, new_status,
                     previous_role, new_role, actor_id, reason)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), organizationId, membershipId, userId, changeType, previousStatus, newStatus,
                previousRole, newRole, actorId, reason);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void ownership(UUID organizationId, String subjectType, String subjectId, UUID previousOwner,
            UUID newOwner, String changeType, UUID actorId, String reason) {
        jdbc.update("""
                INSERT INTO ownership_history
                    (id, org_id, subject_type, subject_id, previous_owner_membership_id, new_owner_membership_id,
                     change_type, actor_id, reason)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), organizationId, subjectType, subjectId, previousOwner, newOwner, changeType,
                actorId, reason);
    }
}
