package com.prowise.operator;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OperatorInvitationRepository extends JpaRepository<OperatorInvitationEntity, UUID> {
    Optional<OperatorInvitationEntity> findByTokenHashAndAcceptedAtIsNull(String tokenHash);

    /** Atomic single use: of concurrent acceptances only one marks the open, unexpired invitation accepted. */
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("UPDATE OperatorInvitationEntity i SET i.acceptedAt = :now "
            + "WHERE i.tokenHash = :hash AND i.acceptedAt IS NULL AND i.expiresAt > :now")
    int markAcceptedIfOpen(@org.springframework.data.repository.query.Param("hash") String hash,
            @org.springframework.data.repository.query.Param("now") java.time.Instant now);
    Optional<OperatorInvitationEntity> findTopByEmailIgnoreCaseOrderByCreatedAtDesc(String email);

    /** Invitations not yet accepted (expired ones included); a resend expires the ones still valid. */
    List<OperatorInvitationEntity> findByOperatorIdAndAcceptedAtIsNull(String operatorId);
}
