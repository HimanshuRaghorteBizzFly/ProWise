package com.prowise.notification.smtp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("SMTP")
class SmtpCredentialCipherTest {

    private static final String KEY = "unit-test-smtp-credential-key-that-is-long-enough";

    @Test
    void roundTripsWithoutStoringPlaintext() {
        SmtpCredentialCipher cipher = new SmtpCredentialCipher(KEY);
        String stored = cipher.encrypt("abcd efgh ijkl mnop");

        assertThat(stored).startsWith("v1:").doesNotContain("abcd").doesNotContain("efgh");
        assertThat(cipher.decrypt(stored)).isEqualTo("abcd efgh ijkl mnop");
    }

    @Test
    void sameSecretEncryptsDifferentlyEachTime() {
        SmtpCredentialCipher cipher = new SmtpCredentialCipher(KEY);
        assertThat(cipher.encrypt("same-secret")).isNotEqualTo(cipher.encrypt("same-secret"));
    }

    @Test
    void tamperedOrForeignCiphertextIsRejected() {
        SmtpCredentialCipher cipher = new SmtpCredentialCipher(KEY);
        String stored = cipher.encrypt("secret-value");
        String tampered = stored.substring(0, stored.length() - 2) + (stored.endsWith("A") ? "BB" : "AA");

        assertThatThrownBy(() -> cipher.decrypt(tampered)).isInstanceOf(SmtpCredentialCipher.CredentialUnreadableException.class);
        assertThatThrownBy(() -> new SmtpCredentialCipher("another-key-of-sufficient-length-for-aes-0001").decrypt(stored))
                .isInstanceOf(SmtpCredentialCipher.CredentialUnreadableException.class);
        assertThatThrownBy(() -> cipher.decrypt("enc_6d1f2c1e-legacy-fake"))
                .isInstanceOf(SmtpCredentialCipher.CredentialUnreadableException.class);
    }

    @Test
    void missingOrShortKeyMeansEncryptionIsUnavailable() {
        assertThat(new SmtpCredentialCipher("").isAvailable()).isFalse();
        assertThat(new SmtpCredentialCipher("too-short").isAvailable()).isFalse();
        assertThatThrownBy(() -> new SmtpCredentialCipher("").encrypt("x")).isInstanceOf(IllegalStateException.class);
    }
}
