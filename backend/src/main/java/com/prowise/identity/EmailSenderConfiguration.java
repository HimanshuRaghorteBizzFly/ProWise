package com.prowise.identity;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.prowise.notification.EmailSender;

@Configuration
public class EmailSenderConfiguration {

    @Bean
    @ConditionalOnMissingBean(EmailSender.class)
    EmailSender defaultEmailSender() {
        return message -> { };
    }
}
