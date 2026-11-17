package com.prowise.testsupport.github;

import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Test-only GitHub webhook signer: HMAC-SHA256 over the raw body, sent as
 * {@code X-Hub-Signature-256: sha256=<hex>}. The key below is a public, test-only value.
 */
public final class GitHubWebhookSigner {

    public static final String SIGNATURE_HEADER = "X-Hub-Signature-256";
    public static final String DELIVERY_HEADER = "X-GitHub-Delivery";
    public static final String EVENT_HEADER = "X-GitHub-Event";
    /** Dummy webhook key used only by synthetic fixtures. Not a real credential. */
    public static final String TEST_WEBHOOK_KEY = "TEST-ONLY-prowise-webhook-key";

    private static final String PREFIX = "sha256=";

    private final byte[] key;

    public GitHubWebhookSigner(String key) {
        this.key = key.getBytes(StandardCharsets.UTF_8);
    }

    public static GitHubWebhookSigner forTests() {
        return new GitHubWebhookSigner(TEST_WEBHOOK_KEY);
    }

    public String sign(byte[] body) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return PREFIX + HexFormat.of().formatHex(mac.doFinal(body));
        } catch (NoSuchAlgorithmException | InvalidKeyException exception) {
            throw new IllegalStateException("HmacSHA256 unavailable", exception);
        }
    }

    /** Constant-time comparison, as the real receiver must do. */
    public boolean verify(byte[] body, String signatureHeader) {
        if (signatureHeader == null || !signatureHeader.startsWith(PREFIX)) {
            return false;
        }
        byte[] expected = sign(body).getBytes(StandardCharsets.US_ASCII);
        byte[] actual = signatureHeader.getBytes(StandardCharsets.US_ASCII);
        return MessageDigest.isEqual(expected, actual);
    }
}
