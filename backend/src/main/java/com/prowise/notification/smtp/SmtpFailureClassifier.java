package com.prowise.notification.smtp;

import java.net.ConnectException;
import java.net.NoRouteToHostException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.util.Locale;

import javax.net.ssl.SSLException;

import jakarta.mail.AuthenticationFailedException;
import jakarta.mail.MessagingException;

import org.eclipse.angus.mail.smtp.SMTPAddressFailedException;
import org.eclipse.angus.mail.smtp.SMTPSenderFailedException;

/**
 * Turns a mail exception into a status and an administrator-safe explanation. The explanation may contain the
 * SMTP server's own reply (for example "535 5.7.8 Username and Password not accepted") but never a credential.
 */
public final class SmtpFailureClassifier {

    private SmtpFailureClassifier() {}

    public record Classification(SmtpStatus status, String detail) {}

    public static Classification classify(Throwable failure) {
        String reply = serverReply(failure);
        // Pass 1: exception types anywhere in the chain (most reliable).
        for (Throwable t = failure; t != null; t = next(t)) {
            if (t instanceof AuthenticationFailedException) {
                return new Classification(SmtpStatus.AUTHENTICATION_FAILED, withReply(
                        "The SMTP server rejected the username or password. For Gmail, use a 16-character App Password "
                                + "(Google Account > Security > 2-Step Verification > App passwords), not the account password.",
                        reply != null ? reply : safeMessage(t)));
            }
            if (t instanceof SMTPSenderFailedException) {
                return new Classification(SmtpStatus.SENDER_REJECTED, withReply("The SMTP server rejected the sender address.", safeMessage(t)));
            }
            if (t instanceof SMTPAddressFailedException) {
                return new Classification(SmtpStatus.RECIPIENT_REJECTED, withReply("The SMTP server rejected the recipient address.", safeMessage(t)));
            }
            if (t instanceof SSLException) {
                return tlsFailure(t);
            }
            if (t instanceof SocketTimeoutException) {
                return timeout();
            }
            if (t instanceof ConnectException || t instanceof UnknownHostException || t instanceof NoRouteToHostException) {
                return new Classification(SmtpStatus.SERVER_UNAVAILABLE, withReply(
                        "The SMTP server could not be reached. Check the host name and port.", t.getClass().getSimpleName()));
            }
        }
        // Pass 2: protocol-level failures Angus reports only as message text.
        for (Throwable t = failure; t != null; t = next(t)) {
            if (containsAny(t, "starttls", "ssl", "handshake", "certificate", "pkix")) {
                return tlsFailure(t);
            }
            if (containsAny(t, "timed out")) {
                return timeout();
            }
            if (containsAny(t, "bad greeting", " 421", "421 ", "service not available")) {
                return new Classification(SmtpStatus.SERVER_UNAVAILABLE, withReply(
                        "The SMTP server is temporarily refusing connections.", safeMessage(t)));
            }
        }
        return new Classification(SmtpStatus.DISCONNECTED, withReply("The SMTP conversation failed.",
                reply != null ? reply : safeMessage(failure)));
    }

    private static Classification tlsFailure(Throwable t) {
        return new Classification(SmtpStatus.TLS_FAILURE, withReply(
                "TLS could not be established. Check the encryption setting (STARTTLS on 587, SSL on 465) "
                        + "and that the server presents a valid certificate.", safeMessage(t)));
    }

    private static Classification timeout() {
        return new Classification(SmtpStatus.CONNECTION_TIMEOUT,
                "The SMTP server did not answer in time. Check the host, port and any firewall between this server and it.");
    }

    private static Throwable next(Throwable t) {
        if (t instanceof MessagingException messaging && messaging.getNextException() != null
                && messaging.getNextException() != t) {
            return messaging.getNextException();
        }
        return t.getCause() == t ? null : t.getCause();
    }

    private static boolean containsAny(Throwable t, String... needles) {
        String message = t.getMessage();
        if (message == null) return false;
        String lower = message.toLowerCase(Locale.ROOT);
        for (String needle : needles) {
            if (lower.contains(needle)) return true;
        }
        return false;
    }

    /** Server replies carried by Angus exceptions, when available. */
    private static String serverReply(Throwable failure) {
        for (Throwable t = failure; t != null; t = next(t)) {
            if (t instanceof AuthenticationFailedException && t.getMessage() != null && !t.getMessage().isBlank()) {
                return oneLine(t.getMessage());
            }
        }
        return null;
    }

    /** First line of an exception message, length-capped. Mail exceptions never include passwords. */
    static String safeMessage(Throwable t) {
        String message = t.getMessage();
        return message == null || message.isBlank() ? t.getClass().getSimpleName() : oneLine(message);
    }

    private static String oneLine(String text) {
        String first = text.strip().lines().map(String::strip).reduce((a, b) -> a + " " + b).orElse("");
        return first.length() > 300 ? first.substring(0, 300) : first;
    }

    private static String withReply(String explanation, String reply) {
        return reply == null || reply.isBlank() ? explanation : explanation + " Server said: " + reply;
    }
}
