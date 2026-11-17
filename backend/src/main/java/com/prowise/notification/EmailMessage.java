package com.prowise.notification;

public record EmailMessage(String to, String subject, String textBody) {

    public EmailMessage {
        if (to == null || to.isBlank()) {
            throw new IllegalArgumentException("recipient is required");
        }
        if (subject == null || subject.isBlank()) {
            throw new IllegalArgumentException("subject is required");
        }
        textBody = textBody == null ? "" : textBody;
    }
}
