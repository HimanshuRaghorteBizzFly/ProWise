package com.prowise.notification.smtp;

import java.io.UnsupportedEncodingException;
import java.util.ArrayDeque;
import java.util.Date;
import java.util.Deque;
import java.util.Properties;
import java.util.regex.Pattern;

import jakarta.mail.MessagingException;
import jakarta.mail.Session;
import jakarta.mail.Transport;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;

import org.eclipse.angus.mail.smtp.SMTPTransport;

/**
 * The only place ProWise talks to an SMTP server. Every result reflects what the server really answered:
 * CONNECTED only after a successful TCP connect, TLS negotiation (when configured) and AUTH; accepted only
 * after the server's 250 reply to DATA. Passwords are passed to the transport and never logged or returned.
 */
public class SmtpMailGateway {

    /** Strict envelope address: no whitespace, CR/LF or angle brackets, so it can never inject SMTP commands. */
    private static final Pattern ENVELOPE_ADDRESS = Pattern.compile("^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(\\.[A-Za-z0-9-]+)+$");

    private final SmtpTimeouts timeouts;
    private final Deque<Long> recentSends = new ArrayDeque<>();

    public SmtpMailGateway(SmtpTimeouts timeouts) {
        this.timeouts = timeouts;
    }

    public record ConnectionResult(SmtpStatus status, long latencyMs, String serverResponse, String detail, boolean encrypted) {}

    /** {@code status} is CONNECTED when accepted; otherwise the failure category. */
    public record Receipt(boolean accepted, SmtpStatus status, int attempts, String messageId, String smtpResponse,
            String sender, String errorDetail) {}

    public record SenderCheck(boolean accepted, SmtpStatus connectionStatus, String smtpResponse, String detail,
            boolean matchesAuthenticatedAccount) {}

    @FunctionalInterface
    public interface MessageComposer {
        void compose(MimeMessage message) throws MessagingException;
    }

    public static boolean isValidAddress(String address) {
        return address != null && address.length() <= 320 && ENVELOPE_ADDRESS.matcher(address).matches();
    }

    /** A mail session for these settings: auth, STARTTLS required or implicit TLS, and all three timeouts. */
    public Session session(SmtpSettings settings) {
        Properties props = new Properties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.host", nullToEmpty(settings.host()));
        props.put("mail.smtp.port", String.valueOf(settings.port()));
        props.put("mail.smtp.auth", String.valueOf(settings.hasUsername()));
        props.put("mail.smtp.connectiontimeout", String.valueOf(timeouts.connectMs()));
        props.put("mail.smtp.timeout", String.valueOf(timeouts.readMs()));
        props.put("mail.smtp.writetimeout", String.valueOf(timeouts.writeMs()));
        if (settings.fromEmail() != null && !settings.fromEmail().isBlank()) {
            props.put("mail.smtp.from", settings.fromEmail());
        }
        switch (settings.encryption()) {
            case TLS -> {
                props.put("mail.smtp.starttls.enable", "true");
                props.put("mail.smtp.starttls.required", "true");
                props.put("mail.smtp.ssl.checkserveridentity", "true");
                props.put("mail.smtp.ssl.protocols", "TLSv1.2 TLSv1.3");
            }
            case SSL -> {
                props.put("mail.smtp.ssl.enable", "true");
                props.put("mail.smtp.ssl.checkserveridentity", "true");
                props.put("mail.smtp.ssl.protocols", "TLSv1.2 TLSv1.3");
            }
            case NONE -> props.put("mail.smtp.starttls.enable", "false");
        }
        return Session.getInstance(props);
    }

    /** Connect, negotiate TLS, authenticate, then QUIT. Nothing is sent. */
    public ConnectionResult testConnection(SmtpSettings settings) {
        if (!settings.isComplete()) {
            return new ConnectionResult(SmtpStatus.NOT_CONFIGURED, 0, null,
                    "SMTP host, username, password and sender email must all be set before a connection test.", false);
        }
        long started = System.nanoTime();
        Transport transport = null;
        try {
            transport = session(settings).getTransport("smtp");
            transport.connect(settings.host(), settings.port(), settings.username(), settings.password());
            String response = lastResponse(transport);
            boolean encrypted = settings.encryption() != SmtpSettings.Encryption.NONE;
            return new ConnectionResult(SmtpStatus.CONNECTED, elapsed(started), response,
                    "Connected to " + settings.host() + ":" + settings.port()
                            + (encrypted ? " over " + (settings.encryption() == SmtpSettings.Encryption.TLS ? "STARTTLS" : "SSL/TLS") : " without encryption")
                            + " and authenticated as " + settings.username() + ".", encrypted);
        } catch (MessagingException | RuntimeException e) {
            SmtpFailureClassifier.Classification c = SmtpFailureClassifier.classify(e);
            String response = transport != null ? lastResponse(transport) : null;
            return new ConnectionResult(c.status(), elapsed(started), response, appendReply(c.detail(), response), false);
        } finally {
            closeQuietly(transport);
        }
    }

    /** Build a message with this gateway's session and send it. */
    public Receipt send(SmtpSettings settings, MessageComposer composer) {
        MimeMessage message = new MimeMessage(session(settings));
        try {
            composer.compose(message);
        } catch (MessagingException e) {
            return new Receipt(false, SmtpStatus.DISCONNECTED, 0, null, null, settings.fromEmail(),
                    "The message could not be built: " + SmtpFailureClassifier.safeMessage(e));
        }
        return send(settings, message);
    }

    /** Send an already built message, retrying transient failures up to the configured attempts. */
    public Receipt send(SmtpSettings settings, MimeMessage message) {
        String sender = settings.fromEmail();
        if (!settings.hasHost() || !settings.hasUsername()) {
            return new Receipt(false, SmtpStatus.NOT_CONFIGURED, 0, null, null, sender, "Outgoing email is not configured.");
        }
        if (!acquireSendSlot(settings.rateLimitPerMinute())) {
            return new Receipt(false, SmtpStatus.RATE_LIMITED, 0, null, null, sender,
                    "The configured sending limit of " + settings.rateLimitPerMinute() + " emails per minute was reached.");
        }
        String messageId;
        try {
            applyEnvelope(message, settings);
            message.saveChanges();
            messageId = message.getMessageID();
        } catch (MessagingException | UnsupportedEncodingException e) {
            return new Receipt(false, SmtpStatus.DISCONNECTED, 0, null, null, sender,
                    "The message could not be prepared: " + SmtpFailureClassifier.safeMessage(e));
        }

        int maxAttempts = settings.safeRetryAttempts();
        Session session = session(settings);
        for (int attempt = 1; ; attempt++) {
            Transport transport = null;
            try {
                transport = session.getTransport("smtp");
                transport.connect(settings.host(), settings.port(), settings.username(), settings.password());
                transport.sendMessage(message, message.getAllRecipients());
                return new Receipt(true, SmtpStatus.CONNECTED, attempt, messageId, lastResponse(transport), sender, null);
            } catch (MessagingException | RuntimeException e) {
                SmtpFailureClassifier.Classification c = SmtpFailureClassifier.classify(e);
                String response = transport != null ? lastResponse(transport) : null;
                if (!c.status().isTransient() || attempt >= maxAttempts) {
                    return new Receipt(false, c.status(), attempt, messageId, response, sender, appendReply(c.detail(), response));
                }
            } finally {
                closeQuietly(transport);
            }
            pause(settings.safeRetryWaitSeconds());
        }
    }

    /**
     * Ask the server whether it accepts this envelope sender (MAIL FROM), then RSET. Nothing is sent. Gmail accepts
     * any envelope sender but rewrites the visible From to the authenticated account unless the address is a
     * verified "Send mail as" alias, so the result also says whether the sender matches the account.
     */
    public SenderCheck verifySender(SmtpSettings settings, String senderEmail) {
        if (!isValidAddress(senderEmail)) {
            return new SenderCheck(false, SmtpStatus.SENDER_REJECTED, null, "The sender address is not a valid email address.", false);
        }
        boolean matches = settings.hasUsername() && senderEmail.equalsIgnoreCase(settings.username().trim());
        if (!settings.isComplete()) {
            return new SenderCheck(false, SmtpStatus.NOT_CONFIGURED, null, "SMTP settings are incomplete.", matches);
        }
        Transport transport = null;
        try {
            transport = session(settings).getTransport("smtp");
            transport.connect(settings.host(), settings.port(), settings.username(), settings.password());
            SMTPTransport smtp = (SMTPTransport) transport;
            int code = smtp.simpleCommand("MAIL FROM:<" + senderEmail + ">");
            String response = smtp.getLastServerResponse();
            smtp.simpleCommand("RSET");
            boolean accepted = code == 250;
            String detail;
            if (!accepted) {
                detail = "The SMTP server rejected this sender address.";
            } else if (matches) {
                detail = "The SMTP server accepted this sender, and it matches the authenticated account.";
            } else {
                detail = "The SMTP server accepted this envelope sender, but it differs from the authenticated account ("
                        + settings.username() + "). Gmail shows the account address as From unless this address is a "
                        + "verified \"Send mail as\" alias of that account.";
            }
            return new SenderCheck(accepted, SmtpStatus.CONNECTED, oneLine(response), detail, matches);
        } catch (MessagingException | RuntimeException e) {
            SmtpFailureClassifier.Classification c = SmtpFailureClassifier.classify(e);
            String response = transport != null ? lastResponse(transport) : null;
            return new SenderCheck(false, c.status(), response, appendReply(c.detail(), response), matches);
        } finally {
            closeQuietly(transport);
        }
    }

    private static void applyEnvelope(MimeMessage message, SmtpSettings settings)
            throws MessagingException, UnsupportedEncodingException {
        if (message.getHeader("From") == null && settings.fromEmail() != null && !settings.fromEmail().isBlank()) {
            String name = settings.fromName();
            message.setFrom(name != null && !name.isBlank()
                    ? new InternetAddress(settings.fromEmail(), name.trim(), "UTF-8")
                    : new InternetAddress(settings.fromEmail()));
        }
        if (message.getHeader("Reply-To") == null && settings.replyTo() != null && !settings.replyTo().isBlank()) {
            message.setReplyTo(new InternetAddress[] {new InternetAddress(settings.replyTo())});
        }
        if (message.getSentDate() == null) {
            message.setSentDate(new Date());
        }
    }

    private synchronized boolean acquireSendSlot(int perMinute) {
        if (perMinute <= 0) return true;
        long now = System.currentTimeMillis();
        while (!recentSends.isEmpty() && now - recentSends.peekFirst() >= 60_000) {
            recentSends.pollFirst();
        }
        if (recentSends.size() >= perMinute) return false;
        recentSends.addLast(now);
        return true;
    }

    private static String lastResponse(Transport transport) {
        if (transport instanceof SMTPTransport smtp) {
            return oneLine(smtp.getLastServerResponse());
        }
        return null;
    }

    private static String oneLine(String response) {
        if (response == null) return null;
        String joined = response.strip().lines().map(String::strip).reduce((a, b) -> a + " " + b).orElse("");
        return joined.isEmpty() ? null : (joined.length() > 500 ? joined.substring(0, 500) : joined);
    }

    private static String appendReply(String detail, String response) {
        if (response == null || response.isBlank() || detail.contains(response)) return detail;
        return detail + " Last server reply: " + response;
    }

    private static void closeQuietly(Transport transport) {
        if (transport == null) return;
        try {
            transport.close();
        } catch (MessagingException | RuntimeException ignored) {
            // already disconnected
        }
    }

    private static void pause(int seconds) {
        if (seconds <= 0) return;
        try {
            Thread.sleep(seconds * 1000L);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static long elapsed(long startedNanos) {
        return (System.nanoTime() - startedNanos) / 1_000_000;
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
