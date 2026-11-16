package com.prowise.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.stream.IntStream;

import org.junit.jupiter.api.Test;

class InMemoryEmailSenderTest {

    @Test
    void recordsMessagesPerRecipient() {
        InMemoryEmailSender sender = new InMemoryEmailSender();

        sender.send(new EmailMessage("owner@org-a.test", "Check-in reminder", "Please submit your check-in."));
        sender.send(new EmailMessage("pm@org-b.test", "Approval needed", "Scope v2 waits for you."));

        assertThat(sender.sent()).hasSize(2);
        assertThat(sender.sentTo("OWNER@org-a.test")).singleElement()
                .extracting(EmailMessage::subject).isEqualTo("Check-in reminder");
        sender.clear();
        assertThat(sender.sent()).isEmpty();
    }

    @Test
    void isSafeUnderConcurrentSends() {
        InMemoryEmailSender sender = new InMemoryEmailSender();

        IntStream.range(0, 200).parallel()
                .forEach(i -> sender.send(new EmailMessage("developer@org-a.test", "n" + i, "body")));

        assertThat(sender.sent()).hasSize(200);
    }

    @Test
    void messageRejectsBlankRecipient() {
        assertThatThrownBy(() -> new EmailMessage(" ", "subject", "body"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
