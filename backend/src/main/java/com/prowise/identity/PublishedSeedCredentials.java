package com.prowise.identity;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * Login accounts that earlier migrations (V7, V9, V10, V11) and the old development initializer created with
 * passwords published in this repository. These values are a deny list: they are public already, and they are
 * kept only so the platform can recognise an account that still uses one and refuse it.
 *
 * <p>An account counts as an insecure seed only when its stored BCrypt hash verifies against a published
 * password. A seeded address whose owner has since chosen another password is a legitimate account.
 */
public final class PublishedSeedCredentials {

    public static final String SUPER_ADMIN = "SuperAdmin2026!";
    public static final String OPERATOR = "Operator2026!";
    public static final String DEVELOPER = "Developer2026!";

    /** Every password published for a seeded login, in the order most accounts used them. */
    public static final List<String> PASSWORDS = List.of(
            SUPER_ADMIN, OPERATOR, DEVELOPER,
            "Owner2026!", "Admin2026!", "Manager2026!", "Lead2026!", "Reviewer2026!", "Viewer2026!");

    /** Seeded {@code users} addresses and the password each one was published with. */
    public static final Map<String, String> USER_ACCOUNTS = Map.ofEntries(
            Map.entry("superadmin@prowise.com", SUPER_ADMIN),
            Map.entry("superadmin@prowise.io", SUPER_ADMIN),
            Map.entry("operator@prowise.io", OPERATOR),
            Map.entry("main.operator@prowise.io", OPERATOR),
            Map.entry("alex.rivera@acmehealth.com", DEVELOPER),
            Map.entry("developer@prowise.com", DEVELOPER),
            Map.entry("dr.sarah.lin@acmehealth.com", "Owner2026!"),
            Map.entry("david.kim@acmehealth.com", "Admin2026!"),
            Map.entry("priya.raman@acmehealth.com", "Manager2026!"),
            Map.entry("marcus.chen@acmehealth.com", "Lead2026!"),
            Map.entry("elena.ruiz@acmehealth.com", "Reviewer2026!"),
            Map.entry("jordan.lee@acmehealth.com", "Viewer2026!"));

    private static final BCryptPasswordEncoder BCRYPT = new BCryptPasswordEncoder();

    private PublishedSeedCredentials() {}

    public static boolean isSeededUserEmail(String email) {
        return email != null && USER_ACCOUNTS.containsKey(email.trim().toLowerCase(Locale.ROOT));
    }

    /**
     * True when {@code bcryptHash} verifies against any published password. The account's own published
     * password (if known) is tried first, so a matching seed costs one BCrypt comparison.
     */
    public static boolean matchesPublishedPassword(String email, String bcryptHash) {
        if (bcryptHash == null || !bcryptHash.startsWith("$2")) {
            return false;
        }
        List<String> candidates = new ArrayList<>(PASSWORDS.size());
        String own = email == null ? null : USER_ACCOUNTS.get(email.trim().toLowerCase(Locale.ROOT));
        if (own != null) {
            candidates.add(own);
        }
        for (String password : PASSWORDS) {
            if (!password.equals(own)) {
                candidates.add(password);
            }
        }
        for (String password : candidates) {
            try {
                if (BCRYPT.matches(password, bcryptHash)) {
                    return true;
                }
            } catch (IllegalArgumentException malformedHash) {
                return false;
            }
        }
        return false;
    }
}
