package com.prowise.identity;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.prowise.notification.EmailSender;

/**
 * The {@link EmailSender} notification port sends for real through SMTP (and is logged like every email).
 * There is no silent no-op sender: when SMTP is not configured the attempt is logged as NOT_SENT.
 */
@Configuration
public class EmailSenderConfiguration {

    @Bean
    @ConditionalOnMissingBean(EmailSender.class)
    EmailSender smtpEmailSender(EmailCredentialService emailCredentialService) {
        return emailCredentialService::sendNotification;
    }
}
