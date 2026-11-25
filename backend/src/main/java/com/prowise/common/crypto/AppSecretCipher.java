package com.prowise.common.crypto;

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
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import com.prowise.common.api.ApiException;

/**
 * Encrypts integration secrets at rest (GitHub tokens and webhook secrets): AES-256-GCM, a random 96-bit IV per
 * value, JDK only. The key comes from {@code APP_ENCRYPTION_KEY} (at least 32 characters, hashed to 256 bits) and
 * never leaves the server. Stored format: {@code v1:<base64(iv || ciphertext+tag)>}. Plaintext and ciphertext are
 * never put in exception messages or logs.
 *
 * <p>The key is optional for the application as a whole: without it, only the features that store secrets refuse to
 * work (503 ENCRYPTION_KEY_MISSING), so the rest of the product keeps running.
 */
@Component
public class AppSecretCipher {

    private static final String PREFIX = "v1:";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;
    private static final int MIN_KEY_CHARS = 32;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final SecretKeySpec key;

    public AppSecretCipher(@Value("${prowise.security.app-encryption-key:${APP_ENCRYPTION_KEY:}}") String configuredKey) {
        this.key = configuredKey != null && configuredKey.trim().length() >= MIN_KEY_CHARS
                ? new SecretKeySpec(sha256(configuredKey.trim()), "AES")
                : null;
    }

    public boolean isAvailable() {
        return key != null;
    }

    public String encrypt(String plaintext) {
        requireKey();
        try {
            byte[] iv = new byte[IV_BYTES];
            RANDOM.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            byte[] sealed = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            return PREFIX + Base64.getEncoder().encodeToString(
                    ByteBuffer.allocate(iv.length + sealed.length).put(iv).put(sealed).array());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Secret encryption failed.");
        }
    }

    public String decrypt(String stored) {
        requireKey();
        if (stored == null || !stored.startsWith(PREFIX)) {
            throw new IllegalStateException("The stored secret is not in a readable format.");
        }
        try {
            byte[] all = Base64.getDecoder().decode(stored.substring(PREFIX.length()));
            if (all.length <= IV_BYTES) throw new IllegalStateException("The stored secret is truncated.");
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, all, 0, IV_BYTES));
            return new String(cipher.doFinal(all, IV_BYTES, all.length - IV_BYTES), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalStateException("The stored secret cannot be decrypted with the current key.");
        }
    }

    private void requireKey() {
        if (key == null) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "ENCRYPTION_KEY_MISSING",
                    "The server has no APP_ENCRYPTION_KEY, so integration secrets cannot be stored. Ask an administrator.");
        }
    }

    private static byte[] sha256(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
