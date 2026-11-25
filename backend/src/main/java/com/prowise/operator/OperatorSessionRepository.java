package com.prowise.operator;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OperatorSessionRepository extends JpaRepository<OperatorSessionEntity, UUID> {
    List<OperatorSessionEntity> findByOperatorIdAndRevokedFalse(String operatorId);

    java.util.Optional<OperatorSessionEntity> findByRefreshTokenHashAndRevokedFalse(String refreshTokenHash);

    /** Atomic rotation claim: 1 for the single caller that revoked the session, 0 for every concurrent loser. */
    @Modifying
    @Query("UPDATE OperatorSessionEntity s SET s.revoked = true, s.revokedAt = CURRENT_TIMESTAMP, s.revokedBy = 'TOKEN_ROTATED' "
            + "WHERE s.id = :id AND s.revoked = false")
    int claimForRotation(@Param("id") UUID id);

    /** Owner of an already revoked (rotated or signed-out) refresh token: presenting it again means reuse. */
    @Query("SELECT s.operatorId FROM OperatorSessionEntity s WHERE s.refreshTokenHash = :hash AND s.revoked = true")
    List<String> findOperatorIdsByRevokedRefreshTokenHash(@Param("hash") String hash);

    @Modifying
    @Query("UPDATE OperatorSessionEntity s SET s.revoked = true, s.revokedAt = CURRENT_TIMESTAMP, s.revokedBy = :actor WHERE s.operatorId = :operatorId AND s.revoked = false")
    int revokeAllByOperatorId(@Param("operatorId") String operatorId, @Param("actor") String actor);
}
