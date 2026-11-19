package com.prowise.operator;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OperatorInvitationRepository extends JpaRepository<OperatorInvitationEntity, UUID> {
    Optional<OperatorInvitationEntity> findByTokenHashAndAcceptedAtIsNull(String tokenHash);
    Optional<OperatorInvitationEntity> findTopByEmailIgnoreCaseOrderByCreatedAtDesc(String email);
}
