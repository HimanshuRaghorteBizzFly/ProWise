package com.prowise.operator;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface OperatorPasswordResetRepository extends JpaRepository<OperatorPasswordResetEntity, UUID> {
    Optional<OperatorPasswordResetEntity> findByTokenHashAndUsedAtIsNull(String tokenHash);

    Optional<OperatorPasswordResetEntity> findByTokenHash(String tokenHash);

    /**
     * Marks an unused, unexpired reset token used in one statement, so two concurrent submissions of the same
     * link cannot both succeed. Returns 1 for the single winner and 0 otherwise.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE OperatorPasswordResetEntity r SET r.usedAt = :now "
            + "WHERE r.tokenHash = :tokenHash AND r.usedAt IS NULL AND r.expiresAt > :now")
    int markUsedIfOpen(@Param("tokenHash") String tokenHash, @Param("now") Instant now);

    /** Expires every open reset link of an operator; a new request supersedes the previous one. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE OperatorPasswordResetEntity r SET r.usedAt = :now WHERE r.operatorId = :operatorId AND r.usedAt IS NULL")
    int expireOpenForOperator(@Param("operatorId") String operatorId, @Param("now") Instant now);
}
