package com.prowise.notification;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/** Test double: records messages instead of sending them. Never touches the network. */
public class InMemoryEmailSender implements EmailSender {

    private final List<EmailMessage> sent = new CopyOnWriteArrayList<>();

    @Override
    public void send(EmailMessage message) {
        sent.add(message);
    }

    public List<EmailMessage> sent() {
        return List.copyOf(sent);
    }

    public List<EmailMessage> sentTo(String recipient) {
        return sent.stream().filter(message -> message.to().equalsIgnoreCase(recipient)).toList();
    }

    public void clear() {
        sent.clear();
    }
}
