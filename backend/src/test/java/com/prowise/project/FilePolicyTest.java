package com.prowise.project;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

/** Owner upload rules: screenshots PNG/JPG/WebP up to 5 MB; documents PDF/Office/text/images up to 20 MB. */
@Tag("T33")
class FilePolicyTest {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0};
    private static final byte[] PDF = "%PDF-1.7".getBytes(StandardCharsets.US_ASCII);
    private static final byte[] ZIP = {'P', 'K', 3, 4, 0, 0};

    @Test
    void screenshotsArePngJpgOrWebpUpToFiveMegabytes() {
        assertThat(FilePolicy.check(FilePolicy.Kind.SCREENSHOT, "shot.png", 1000, PNG).accepted()).isTrue();
        assertThat(FilePolicy.check(FilePolicy.Kind.SCREENSHOT, "shot.png", FilePolicy.SCREENSHOT_MAX_BYTES + 1, PNG).problem())
                .contains("5 MB");
        assertThat(FilePolicy.check(FilePolicy.Kind.SCREENSHOT, "spec.pdf", 1000, PDF).accepted()).isFalse();
        assertThat(FilePolicy.check(FilePolicy.Kind.SCREENSHOT, "shot.gif", 1000, "GIF89a".getBytes()).accepted()).isFalse();
    }

    @Test
    void documentsArePdfOfficeTextOrImagesUpToTwentyMegabytes() {
        assertThat(FilePolicy.check(FilePolicy.Kind.PROJECT_DOCUMENT, "brief.pdf", 1000, PDF).contentType())
                .isEqualTo("application/pdf");
        assertThat(FilePolicy.check(FilePolicy.Kind.PROJECT_DOCUMENT, "plan.docx", 1000, ZIP).accepted()).isTrue();
        assertThat(FilePolicy.check(FilePolicy.Kind.PROJECT_DOCUMENT, "notes.md", 10, "# Notes".getBytes()).accepted()).isTrue();
        assertThat(FilePolicy.check(FilePolicy.Kind.PROJECT_DOCUMENT, "brief.pdf", FilePolicy.DOCUMENT_MAX_BYTES + 1, PDF)
                .accepted()).isFalse();
        assertThat(FilePolicy.check(FilePolicy.Kind.PROJECT_DOCUMENT, "tool.exe", 10, "MZ".getBytes()).accepted()).isFalse();
    }

    @Test
    void theContentMustMatchTheExtension() {
        assertThat(FilePolicy.check(FilePolicy.Kind.SCREENSHOT, "fake.png", 100, PDF).problem()).contains(".png");
        assertThat(FilePolicy.check(FilePolicy.Kind.PROJECT_DOCUMENT, "fake.pdf", 100, ZIP).accepted()).isFalse();
        assertThat(FilePolicy.check(FilePolicy.Kind.PROJECT_DOCUMENT, "binary.txt", 3, new byte[] {'a', 0, 'b'}).accepted())
                .isFalse();
        assertThat(FilePolicy.check(FilePolicy.Kind.PROJECT_DOCUMENT, "empty.pdf", 0, new byte[0]).accepted()).isFalse();
    }

    @Test
    void displayNamesDropPathsAndControlCharacters() {
        assertThat(FilePolicy.displayName("..\\..\\etc/passwd.txt")).isEqualTo("passwd.txt");
        assertThat(FilePolicy.displayName("a\u0000b.png")).isEqualTo("a_b.png");
        assertThat(FilePolicy.displayName(null)).isEqualTo("file");
    }
}
