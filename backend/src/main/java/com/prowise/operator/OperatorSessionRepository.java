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

    @Modifying
    @Query("UPDATE OperatorSessionEntity s SET s.revoked = true, s.revokedAt = CURRENT_TIMESTAMP, s.revokedBy = :actor WHERE s.operatorId = :operatorId AND s.revoked = false")
    int revokeAllByOperatorId(@Param("operatorId") String operatorId, @Param("actor") String actor);
}
