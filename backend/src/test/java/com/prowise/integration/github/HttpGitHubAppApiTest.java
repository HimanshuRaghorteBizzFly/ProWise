package com.prowise.integration.github;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.security.KeyPairGenerator;
import java.util.Arrays;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;

/** The GitHub App key handling: GitHub's PKCS#1 PEM is wrapped as PKCS#8; nothing works until fully configured. */
@Tag("T31")
class HttpGitHubAppApiTest {

    @Test
    void wrapsAPkcs1KeyExactlyAsTheJdkEncodesPkcs8() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        byte[] pkcs8 = generator.generateKeyPair().getPrivate().getEncoded();
        // PKCS#8 = SEQUENCE { INTEGER 0, AlgorithmIdentifier(rsaEncryption), OCTET STRING { PKCS#1 } }; for 2048-bit keys
        // the PKCS#1 body starts after 4 + 3 + 15 + 4 header bytes.
        byte[] pkcs1 = Arrays.copyOfRange(pkcs8, 26, pkcs8.length);
        assertThat(HttpGitHubAppApi.pkcs1ToPkcs8(pkcs1)).isEqualTo(pkcs8);
    }

    @Test
    void isNotConfiguredWithoutEverySettingAndRefusesToSign() {
        HttpGitHubAppApi api = new HttpGitHubAppApi(new ObjectMapper(), null, "https://api.github.com", "https://github.com",
                2000, "123", "prowise", "Iv1.abc", "", "-----BEGIN RSA PRIVATE KEY-----\\nAAAA\\n-----END RSA PRIVATE KEY-----", "hook");
        assertThat(api.configured()).isFalse();
        assertThatThrownBy(() -> api.installation(1)).isInstanceOf(GitHubClient.GitHubException.class)
                .hasMessageNotContaining("AAAA");
    }
}
