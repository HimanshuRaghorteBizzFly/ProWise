package com.prowise.identity;

import java.util.ArrayList;
import java.util.List;

/**
 * The one password rule for every account password a person chooses (signup, account activation, reset,
 * change, invitation acceptance): 12 to 200 characters with an uppercase letter, a lowercase letter, a digit
 * and a special character. Pure Java; the frontend mirrors these rules for instant feedback only.
 */
public final class PasswordPolicy {

    public static final int MIN_LENGTH = 12;
    public static final int MAX_LENGTH = 200;
    public static final String SUMMARY =
            "Use 12 to 200 characters with an uppercase letter, a lowercase letter, a number and a special character.";

    private PasswordPolicy() {}

    /** Empty when the password satisfies the policy; otherwise one message per unmet rule. */
    public static List<String> violations(String password) {
        List<String> problems = new ArrayList<>();
        if (password == null || password.length() < MIN_LENGTH) {
            problems.add("At least " + MIN_LENGTH + " characters.");
        }
        if (password != null && password.length() > MAX_LENGTH) {
            problems.add("At most " + MAX_LENGTH + " characters.");
        }
        if (password == null) {
            return problems;
        }
        if (password.chars().noneMatch(Character::isUpperCase)) problems.add("An uppercase letter.");
        if (password.chars().noneMatch(Character::isLowerCase)) problems.add("A lowercase letter.");
        if (password.chars().noneMatch(Character::isDigit)) problems.add("A number.");
        if (password.chars().allMatch(Character::isLetterOrDigit)) problems.add("A special character.");
        return problems;
    }

    public static boolean isAcceptable(String password) {
        return violations(password).isEmpty();
    }
}
