package com.prowise.identity;

import java.security.SecureRandom;

/**
 * Emailed single-use temporary passwords (new platform operators, people invited to an organization). 18 characters
 * from an alphabet without look-alikes (0/O, 1/l/I), about 104 bits: random enough to be stored as a SHA-256 hash like
 * the other one-time secrets, and easy to read from an email and type.
 */
public final class TemporaryPasswords {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    private static final int LENGTH = 18;

    private TemporaryPasswords() {}

    public static String generate() {
        StringBuilder value = new StringBuilder(LENGTH);
        for (int i = 0; i < LENGTH; i++) {
            value.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return value.toString();
    }
}
