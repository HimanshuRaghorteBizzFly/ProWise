package com.prowise.operator;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OperatorInvitationRepository extends JpaRepository<OperatorInvitationEntity, UUID> {
    Optional<OperatorInvitationEntity> findByTokenHashAndAcceptedAtIsNull(String tokenHash);
    Optional<OperatorInvitationEntity> findTopByEmailIgnoreCaseOrderByCreatedAtDesc(String email);

    /** Invitations not yet accepted (expired ones included); a resend expires the ones still valid. */
    List<OperatorInvitationEntity> findByOperatorIdAndAcceptedAtIsNull(String operatorId);
}
