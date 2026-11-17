package com.prowise.common.logging;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.test.context.ActiveProfiles;

/** Exercises the real logback-spring.xml: what reaches the console must already be masked. */
@SpringBootTest
@ActiveProfiles("test")
@ExtendWith(OutputCaptureExtension.class)
@Tag("NFR-08")
class LogRedactionTest {

    private static final Logger log = LoggerFactory.getLogger(LogRedactionTest.class);

    @Test
    void messagesAreMaskedByTheConfiguredLayout(CapturedOutput output) {
        log.info("incoming Authorization: Bearer live-token-AAA111 password=hunter2 Cookie: SESSION=sess-999");

        assertThat(output.getOut()).contains("incoming", SensitiveDataMasker.MASK)
                .doesNotContain("live-token-AAA111", "hunter2", "sess-999");
    }

    @Test
    void exceptionTextIsMaskedToo(CapturedOutput output) {
        log.warn("request failed", new IllegalStateException("upstream rejected client_secret=cs-424242"));

        assertThat(output.getOut()).contains("request failed", "IllegalStateException")
                .doesNotContain("cs-424242");
    }
}
