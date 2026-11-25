package com.prowise.project;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Owner rules for uploads (pure, no Spring), checked on the server whatever the browser claims:
 * <ul>
 *   <li>SCREENSHOT: PNG, JPG or WebP, at most 5 MB.</li>
 *   <li>PROJECT_DOCUMENT: PDF, Word, Excel, PowerPoint, text and images, at most 20 MB.</li>
 * </ul>
 * The extension decides the type and the first bytes must match it (a renamed executable is refused). The stored
 * content type comes from this table, never from the request.
 */
public final class FilePolicy {

    public static final long SCREENSHOT_MAX_BYTES = 5L * 1024 * 1024;
    public static final long DOCUMENT_MAX_BYTES = 20L * 1024 * 1024;

    public enum Kind { PROJECT_DOCUMENT, SCREENSHOT }

    private static final Map<String, String> TYPES = Map.ofEntries(
            Map.entry("png", "image/png"),
            Map.entry("jpg", "image/jpeg"),
            Map.entry("jpeg", "image/jpeg"),
            Map.entry("webp", "image/webp"),
            Map.entry("gif", "image/gif"),
            Map.entry("pdf", "application/pdf"),
            Map.entry("doc", "application/msword"),
            Map.entry("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            Map.entry("xls", "application/vnd.ms-excel"),
            Map.entry("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            Map.entry("ppt", "application/vnd.ms-powerpoint"),
            Map.entry("pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
            Map.entry("txt", "text/plain"),
            Map.entry("md", "text/markdown"),
            Map.entry("csv", "text/csv"));

    private static final Set<String> SCREENSHOT_EXTENSIONS = Set.of("png", "jpg", "jpeg", "webp");
    private static final Set<String> DOCUMENT_EXTENSIONS = TYPES.keySet();

    private FilePolicy() {}

    /** The accepted file, or an explanation of why it is refused. */
    public record Decision(boolean accepted, String contentType, String problem) {
        static Decision refuse(String problem) {
            return new Decision(false, null, problem);
        }
    }

    public static Decision check(Kind kind, String fileName, long size, byte[] head) {
        String extension = extension(fileName);
        if (extension == null) return Decision.refuse("The file needs a name with an extension.");
        Set<String> allowed = kind == Kind.SCREENSHOT ? SCREENSHOT_EXTENSIONS : DOCUMENT_EXTENSIONS;
        if (!allowed.contains(extension)) {
            return Decision.refuse(kind == Kind.SCREENSHOT
                    ? "Screenshots must be PNG, JPG or WebP."
                    : "Documents must be PDF, Word, Excel, PowerPoint, text or images.");
        }
        long max = kind == Kind.SCREENSHOT ? SCREENSHOT_MAX_BYTES : DOCUMENT_MAX_BYTES;
        if (size <= 0) return Decision.refuse("The file is empty.");
        if (size > max) return Decision.refuse("The file is larger than " + (max / (1024 * 1024)) + " MB.");
        if (!signatureMatches(extension, head == null ? new byte[0] : head)) {
            return Decision.refuse("The file content does not match its ." + extension + " extension.");
        }
        return new Decision(true, TYPES.get(extension), null);
    }

    /** A safe display name: no path parts, no control characters, at most 200 characters. */
    public static String displayName(String fileName) {
        String name = fileName == null ? "" : fileName.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}\"<>|*?:]", "_").trim();
        if (name.isEmpty()) name = "file";
        return name.length() > 200 ? name.substring(name.length() - 200) : name;
    }

    static String extension(String fileName) {
        if (fileName == null) return null;
        String name = displayName(fileName);
        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) return null;
        return name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private static boolean signatureMatches(String extension, byte[] head) {
        return switch (extension) {
            case "png" -> starts(head, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A);
            case "jpg", "jpeg" -> starts(head, 0xFF, 0xD8, 0xFF);
            case "gif" -> starts(head, 'G', 'I', 'F', '8');
            case "webp" -> starts(head, 'R', 'I', 'F', 'F') && head.length >= 12
                    && head[8] == 'W' && head[9] == 'E' && head[10] == 'B' && head[11] == 'P';
            case "pdf" -> starts(head, '%', 'P', 'D', 'F');
            case "docx", "xlsx", "pptx" -> starts(head, 'P', 'K', 0x03, 0x04);
            case "doc", "xls", "ppt" -> starts(head, 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1);
            case "txt", "md", "csv" -> isText(head);
            default -> false;
        };
    }

    private static boolean starts(byte[] head, int... expected) {
        if (head.length < expected.length) return false;
        for (int i = 0; i < expected.length; i++) {
            if ((head[i] & 0xFF) != (expected[i] & 0xFF)) return false;
        }
        return true;
    }

    /** Text files: no NUL bytes and valid UTF-8 in the first bytes read. */
    private static boolean isText(byte[] head) {
        for (byte b : head) if (b == 0) return false;
        try {
            StandardCharsets.UTF_8.newDecoder().decode(java.nio.ByteBuffer.wrap(trimPartial(head)));
            return true;
        } catch (java.nio.charset.CharacterCodingException e) {
            return false;
        }
    }

    /** The head may end in the middle of a multi-byte character: drop up to 3 trailing continuation bytes. */
    private static byte[] trimPartial(byte[] head) {
        int end = head.length;
        for (int i = 0; i < 3 && end > 0 && (head[end - 1] & 0xC0) == 0x80; i++) end--;
        if (end > 0 && (head[end - 1] & 0xC0) == 0xC0) end--;
        return java.util.Arrays.copyOf(head, end);
    }
}
