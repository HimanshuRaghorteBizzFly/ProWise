package com.prowise.notification.smtp;

/** Outcome of a real SMTP conversation. NOT_TESTED is only ever the initial state before any test ran. */
public enum SmtpStatus {
    NOT_TESTED,
    NOT_CONFIGURED,
    CONNECTED,
    DISCONNECTED,
    AUTHENTICATION_FAILED,
    TLS_FAILURE,
    CONNECTION_TIMEOUT,
    SERVER_UNAVAILABLE,
    SENDER_REJECTED,
    RECIPIENT_REJECTED,
    RATE_LIMITED;

    /** Worth another attempt: the server may answer next time. Credential, TLS and address problems are not. */
    public boolean isTransient() {
        return this == CONNECTION_TIMEOUT || this == SERVER_UNAVAILABLE || this == DISCONNECTED;
    }
}
