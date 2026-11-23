package com.prowise.notification.smtp;

import java.io.InputStream;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

import org.springframework.mail.MailException;
import org.springframework.mail.MailParseException;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMailMessage;

/**
 * The application's {@link JavaMailSender}: every message goes through {@link SmtpMailGateway} with the settings
 * resolved at send time, so a change saved in the admin panel applies to the next email without a restart.
 * A message is reported as sent only when the SMTP server accepted it; anything else throws.
 */
public class GatewayJavaMailSender implements JavaMailSender {

    private final SmtpSettingsProvider settingsProvider;
    private final SmtpMailGateway gateway;

    public GatewayJavaMailSender(SmtpSettingsProvider settingsProvider, SmtpMailGateway gateway) {
        this.settingsProvider = settingsProvider;
        this.gateway = gateway;
    }

    /** Sends and returns the server's real answer instead of throwing. */
    public SmtpMailGateway.Receipt sendWithReceipt(MimeMessage message) {
        return gateway.send(settingsProvider.current(), message);
    }

    @Override
    public MimeMessage createMimeMessage() {
        return new MimeMessage(gateway.session(settingsProvider.current()));
    }

    @Override
    public MimeMessage createMimeMessage(InputStream contentStream) throws MailException {
        try {
            return new MimeMessage(gateway.session(settingsProvider.current()), contentStream);
        } catch (MessagingException e) {
            throw new MailParseException("Could not parse raw MIME content", e);
        }
    }

    @Override
    public void send(MimeMessage... mimeMessages) throws MailException {
        for (MimeMessage message : mimeMessages) {
            SmtpMailGateway.Receipt receipt = sendWithReceipt(message);
            if (!receipt.accepted()) {
                throw new MailSendException(receipt.status() + ": " + receipt.errorDetail());
            }
        }
    }

    @Override
    public void send(SimpleMailMessage... simpleMessages) throws MailException {
        for (SimpleMailMessage simple : simpleMessages) {
            MimeMessage message = createMimeMessage();
            simple.copyTo(new MimeMailMessage(message));
            send(message);
        }
    }
}
