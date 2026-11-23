package com.prowise.notification.smtp;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Encrypts the SMTP password saved from the admin panel (AES-256-GCM, random 96-bit IV per value, JDK only).
 * The key comes from {@code SMTP_CREDENTIAL_ENCRYPTION_KEY} (at least 32 characters, hashed to 256 bits) and
 * never leaves the server. Stored format: {@code v1:<base64(iv || ciphertext+tag)>}.
 */
@Component
public class SmtpCredentialCipher {

    private static final String PREFIX = "v1:";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;
    private static final int MIN_KEY_CHARS = 32;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final SecretKeySpec key;

    public SmtpCredentialCipher(@Value("${prowise.mail.credential-encryption-key:}") String configuredKey) {
        this.key = configuredKey != null && configuredKey.trim().length() >= MIN_KEY_CHARS
                ? new SecretKeySpec(sha256(configuredKey.trim()), "AES")
                : null;
    }

    public boolean isAvailable() {
        return key != null;
    }

    public String encrypt(String plaintext) {
        if (key == null) {
            throw new IllegalStateException("SMTP_CREDENTIAL_ENCRYPTION_KEY is not configured.");
        }
        try {
            byte[] iv = new byte[IV_BYTES];
            RANDOM.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            byte[] sealed = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            return PREFIX + Base64.getEncoder().encodeToString(ByteBuffer.allocate(iv.length + sealed.length).put(iv).put(sealed).array());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("SMTP credential encryption failed.", e);
        }
    }

    public String decrypt(String stored) {
        if (key == null) {
            throw new CredentialUnreadableException("SMTP_CREDENTIAL_ENCRYPTION_KEY is not configured.");
        }
        if (stored == null || !stored.startsWith(PREFIX)) {
            throw new CredentialUnreadableException("The stored SMTP password is not in a readable format.");
        }
        try {
            byte[] all = Base64.getDecoder().decode(stored.substring(PREFIX.length()));
            if (all.length <= IV_BYTES) throw new CredentialUnreadableException("The stored SMTP password is truncated.");
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, all, 0, IV_BYTES));
            return new String(cipher.doFinal(all, IV_BYTES, all.length - IV_BYTES), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            // Wrong key or tampered value. The exception message never includes the ciphertext.
            throw new CredentialUnreadableException("The stored SMTP password cannot be decrypted with the current key.");
        }
    }

    private static byte[] sha256(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    public static class CredentialUnreadableException extends RuntimeException {
        public CredentialUnreadableException(String message) {
            super(message);
        }
    }
}
