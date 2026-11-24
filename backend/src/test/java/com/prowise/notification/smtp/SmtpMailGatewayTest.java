package com.prowise.notification.smtp;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.InetAddress;
import java.net.ServerSocket;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import com.prowise.testsupport.FakeSmtpServer;
import com.prowise.testsupport.FakeSmtpServer.Mode;

/**
 * The gateway talks real SMTP over a real socket (FakeSmtpServer on 127.0.0.1). Nothing here is simulated:
 * a status is only CONNECTED / SMTP_ACCEPTED when the server actually said so.
 */
@Tag("SMTP")
class SmtpMailGatewayTest {

    private static final SmtpTimeouts FAST = new SmtpTimeouts(2_000, 1_500, 1_500);
    private final SmtpMailGateway gateway = new SmtpMailGateway(FAST);

    private static SmtpSettings settings(int port, SmtpSettings.Encryption encryption, int retryAttempts) {
        return new SmtpSettings("SMTP_CUSTOM", "127.0.0.1", port, encryption, "mailer@example.test", "app-password-123",
                "ProWise Platform", "mailer@example.test", "support@example.test", 120, retryAttempts, 0,
                SmtpSettings.Source.DATABASE);
    }

    @Test
    void connectionSucceedsOnlyAfterRealAuthentication() throws Exception {
        try (FakeSmtpServer server = new FakeSmtpServer(Mode.NORMAL)) {
            SmtpMailGateway.ConnectionResult result = gateway.testConnection(settings(server.port(), SmtpSettings.Encryption.NONE, 1));

            assertThat(result.status()).isEqualTo(SmtpStatus.CONNECTED);
            assertThat(result.serverResponse()).startsWith("235");
            // The configured credentials really went over the wire.
            String presented = String.join("\n", server.authLines());
            assertThat(presented).contains(b64("mailer@example.test")).contains(b64("app-password-123"));
        }
    }

    @Test
    void wrongPasswordIsAuthenticationFailedNotConnected() throws Exception {
        try (FakeSmtpServer server = new FakeSmtpServer(Mode.AUTH_REJECT)) {
            SmtpMailGateway.ConnectionResult result = gateway.testConnection(settings(server.port(), SmtpSettings.Encryption.NONE, 1));

            assertThat(result.status()).isEqualTo(SmtpStatus.AUTHENTICATION_FAILED);
            assertThat(result.detail()).contains("535").doesNotContain("app-password-123");
        }
    }

    @Test
    void serverWithoutStarttlsIsTlsFailureWhenStarttlsIsRequired() throws Exception {
        try (FakeSmtpServer server = new FakeSmtpServer(Mode.NORMAL)) {
            SmtpMailGateway.ConnectionResult result = gateway.testConnection(settings(server.port(), SmtpSettings.Encryption.TLS, 1));

            assertThat(result.status()).isEqualTo(SmtpStatus.TLS_FAILURE);
            // Credentials must never be sent over an unencrypted channel when TLS was requested.
            assertThat(server.authLines()).isEmpty();
        }
    }

    @Test
    void silentServerIsConnectionTimeout() throws Exception {
        try (FakeSmtpServer server = new FakeSmtpServer(Mode.SILENT)) {
            SmtpMailGateway.ConnectionResult result = gateway.testConnection(settings(server.port(), SmtpSettings.Encryption.NONE, 1));

            assertThat(result.status()).isEqualTo(SmtpStatus.CONNECTION_TIMEOUT);
        }
    }

    @Test
    void closedPortIsServerUnavailable() throws Exception {
        int port;
        try (ServerSocket probe = new ServerSocket(0, 1, InetAddress.getLoopbackAddress())) {
            port = probe.getLocalPort();
        }
        SmtpMailGateway.ConnectionResult result = gateway.testConnection(settings(port, SmtpSettings.Encryption.NONE, 1));

        assertThat(result.status()).isEqualTo(SmtpStatus.SERVER_UNAVAILABLE);
    }

    @Test
    void incompleteSettingsAreNotConfiguredAndNoConnectionIsMade() {
        SmtpSettings blank = new SmtpSettings("GMAIL", "smtp.gmail.com", 587, SmtpSettings.Encryption.TLS, "", "",
                "ProWise", "", "", 120, 1, 0, SmtpSettings.Source.ENVIRONMENT);

        assertThat(gateway.testConnection(blank).status()).isEqualTo(SmtpStatus.NOT_CONFIGURED);
    }

    @Test
    void sentMessageReportsTheServersAcceptanceReplyAndMessageId() throws Exception {
        try (FakeSmtpServer server = new FakeSmtpServer(Mode.NORMAL)) {
            SmtpMailGateway.Receipt receipt = gateway.send(settings(server.port(), SmtpSettings.Encryption.NONE, 1), message -> {
                message.setRecipients(jakarta.mail.Message.RecipientType.TO, "owner@example.test");
                message.setSubject("ProWise SMTP Email Verification");
                message.setText("Hello", "UTF-8");
            });

            assertThat(receipt.accepted()).isTrue();
            assertThat(receipt.status()).isEqualTo(SmtpStatus.CONNECTED);
            assertThat(receipt.smtpResponse()).isEqualTo(FakeSmtpServer.QUEUE_REPLY);
            assertThat(receipt.messageId()).isNotBlank();
            assertThat(receipt.attempts()).isEqualTo(1);
            assertThat(server.messages()).hasSize(1);
            String raw = server.messages().get(0);
            assertThat(raw).contains("Subject: ProWise SMTP Email Verification")
                    .contains("ProWise Platform <mailer@example.test>")
                    .contains("Reply-To: support@example.test");
        }
    }

    @Test
    void transientFailureIsRetriedUpToTheConfiguredAttempts() throws Exception {
        try (FakeSmtpServer server = new FakeSmtpServer(Mode.TRANSIENT_THEN_OK)) {
            SmtpMailGateway.Receipt receipt = gateway.send(settings(server.port(), SmtpSettings.Encryption.NONE, 3), message -> {
                message.setRecipients(jakarta.mail.Message.RecipientType.TO, "owner@example.test");
                message.setSubject("Retry");
                message.setText("Hello", "UTF-8");
            });

            assertThat(receipt.accepted()).isTrue();
            assertThat(receipt.attempts()).isEqualTo(2);
        }
    }

    @Test
    void authenticationFailureIsNotRetriedAndIsNotAccepted() throws Exception {
        try (FakeSmtpServer server = new FakeSmtpServer(Mode.AUTH_REJECT)) {
            SmtpMailGateway.Receipt receipt = gateway.send(settings(server.port(), SmtpSettings.Encryption.NONE, 3), message -> {
                message.setRecipients(jakarta.mail.Message.RecipientType.TO, "owner@example.test");
                message.setSubject("Nope");
                message.setText("Hello", "UTF-8");
            });

            assertThat(receipt.accepted()).isFalse();
            assertThat(receipt.status()).isEqualTo(SmtpStatus.AUTHENTICATION_FAILED);
            assertThat(receipt.attempts()).isEqualTo(1);
            assertThat(server.connections()).isEqualTo(1);
            assertThat(server.messages()).isEmpty();
        }
    }

    @Test
    void senderVerificationReportsTheServersRealAnswer() throws Exception {
        try (FakeSmtpServer server = new FakeSmtpServer(Mode.NORMAL)) {
            SmtpMailGateway.SenderCheck accepted = gateway.verifySender(settings(server.port(), SmtpSettings.Encryption.NONE, 1),
                    "mailer@example.test");
            assertThat(accepted.accepted()).isTrue();
            assertThat(accepted.matchesAuthenticatedAccount()).isTrue();

            server.mode(Mode.REJECT_SENDER);
            SmtpMailGateway.SenderCheck rejected = gateway.verifySender(settings(server.port(), SmtpSettings.Encryption.NONE, 1),
                    "someone-else@other.test");
            assertThat(rejected.accepted()).isFalse();
            assertThat(rejected.smtpResponse()).startsWith("553");
            assertThat(rejected.matchesAuthenticatedAccount()).isFalse();
        }
    }

    @Test
    void settingsNeverPrintThePassword() {
        assertThat(settings(25, SmtpSettings.Encryption.NONE, 1).toString()).doesNotContain("app-password-123");
    }

    private static String b64(String value) {
        return Base64.getEncoder().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }
}
