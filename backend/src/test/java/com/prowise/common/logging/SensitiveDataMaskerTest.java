package com.prowise.common.logging;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

@Tag("NFR-08")
class SensitiveDataMaskerTest {

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "Authorization: Bearer eyJhbGciOi.payload.sig|eyJhbGciOi",
            "authorization=Basic dXNlcjpwYXNz|dXNlcjpwYXNz",
            "calling with bearer abc123DEF456ghi|abc123DEF456ghi",
            "login password=hunter2 ok|hunter2",
            "{\"password\":\"hunter2\"}|hunter2",
            "db_password: s3cr3t-value|s3cr3t-value",
            "jwt_secret=topsecretvalue|topsecretvalue",
            "refresh_token=rt-998877|rt-998877",
            "access_token=\"at-112233\"|at-112233",
            "x-api-key: key-445566|key-445566",
            "Cookie: SESSION=abc; theme=dark|SESSION=abc",
            "Set-Cookie: refresh=xyz; HttpOnly|refresh=xyz",
            "X-Hub-Signature-256: sha256=0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0|0f1e2d3c4b5a6978",
            "using ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 now|ghp_ABCDEFGHIJ",
            "jdbc:postgresql://db:5432/app?user=app&password=pw-778899|pw-778899"
    })
    void masksSecrets(String input, String secret) {
        String masked = SensitiveDataMasker.mask(input);

        assertThat(masked).doesNotContain(secret).contains(SensitiveDataMasker.MASK);
    }

    @Test
    void leavesOrdinaryTextAlone() {
        String text = "Project p_crm progress 45% by owner@org-a.test request_id=abc-123";

        assertThat(SensitiveDataMasker.mask(text)).isEqualTo(text);
    }

    @Test
    void handlesNull() {
        assertThat(SensitiveDataMasker.mask(null)).isNull();
    }
}
