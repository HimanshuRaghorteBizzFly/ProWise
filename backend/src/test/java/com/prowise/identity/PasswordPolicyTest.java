package com.prowise.identity;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

@Tag("AS-02")
class PasswordPolicyTest {

    @ParameterizedTest
    @ValueSource(strings = {"Correct-Horse-42!", "Bootstrap-Owner-Pass-7", "Aa1!aaaaaaaa"})
    void acceptsStrongPasswords(String password) {
        assertThat(PasswordPolicy.violations(password)).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "Short-1!",               // under 12 characters
            "correct-horse-battery-1!", // no uppercase
            "CORRECT-HORSE-BATTERY-1", // no lowercase
            "Correct-Horse-Battery",   // no digit
            "CorrectHorseBattery1"     // no special character
    })
    void rejectsWeakPasswords(String password) {
        assertThat(PasswordPolicy.violations(password)).isNotEmpty();
    }

    @Test
    void rejectsMissingAndOverlongPasswords() {
        assertThat(PasswordPolicy.violations(null)).isNotEmpty();
        assertThat(PasswordPolicy.violations("Aa1!" + "x".repeat(200))).isNotEmpty();
    }
}
