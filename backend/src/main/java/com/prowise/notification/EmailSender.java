package com.prowise.notification;

/**
 * Outbound email port. Tests use InMemoryEmailSender; the real SMTP/provider adapter arrives with
 * reminders in task 5.2. Implementations must never log message bodies containing links or tokens.
 */
public interface EmailSender {

    void send(EmailMessage message);
}
