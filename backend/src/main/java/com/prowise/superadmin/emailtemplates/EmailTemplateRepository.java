package com.prowise.superadmin.emailtemplates;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface EmailTemplateRepository extends JpaRepository<EmailTemplateEntity, String> {
    Optional<EmailTemplateEntity> findByTemplateKey(String templateKey);
    List<EmailTemplateEntity> findByCategoryOrderByUpdatedAtDesc(String category);
}
