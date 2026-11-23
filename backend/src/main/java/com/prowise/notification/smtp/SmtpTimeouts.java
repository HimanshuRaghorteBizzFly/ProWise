package com.prowise.notification.smtp;

/** Socket timeouts for every SMTP conversation, in milliseconds. */
public record SmtpTimeouts(int connectMs, int readMs, int writeMs) {}
