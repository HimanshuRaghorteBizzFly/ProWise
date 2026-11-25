package com.prowise.operator.console;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Owner decision: email draft HTML is validated, not sanitized. Refused: script/iframe/frame/object/embed/
 * applet/base/meta/form tags, any on* event-handler attribute, and javascript:, vbscript: or data:text/html
 * URLs (also when hidden with entities, whitespace or control characters). Returns the reason, or null if allowed.
 */
final class EmailHtmlPolicy {

    private static final Pattern FORBIDDEN_TAG =
            Pattern.compile("<\\s*/?\\s*(script|iframe|frame|frameset|object|embed|applet|base|meta|form)\\b",
                    Pattern.CASE_INSENSITIVE);
    private static final Pattern EVENT_HANDLER =
            Pattern.compile("<[^>]*[\\s/\"']on[a-z]+\\s*=", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern NUMERIC_ENTITY = Pattern.compile("&#(x?)([0-9a-f]+);?", Pattern.CASE_INSENSITIVE);

    private EmailHtmlPolicy() {}

    static String violation(String html) {
        if (html == null || html.isBlank()) {
            return null;
        }
        String decoded = decodeEntities(html);
        if (FORBIDDEN_TAG.matcher(decoded).find()) {
            return "must not contain script, iframe, object, embed, form, base or meta tags";
        }
        if (EVENT_HANDLER.matcher(decoded).find()) {
            return "must not contain event handler attributes (on...)";
        }
        // Collapse whitespace and control characters so "java\tscript:" or "java&#10;script:" are caught.
        String compact = decoded.replaceAll("[\\s\\p{Cntrl}]", "").toLowerCase(Locale.ROOT);
        if (compact.contains("javascript:") || compact.contains("vbscript:") || compact.contains("data:text/html")) {
            return "must not contain javascript:, vbscript: or data:text/html URLs";
        }
        return null;
    }

    private static String decodeEntities(String html) {
        Matcher m = NUMERIC_ENTITY.matcher(html);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            String replacement;
            try {
                int code = Integer.parseInt(m.group(2), m.group(1).isEmpty() ? 10 : 16);
                replacement = Character.isValidCodePoint(code) ? new String(Character.toChars(code)) : "";
            } catch (NumberFormatException e) {
                replacement = "";
            }
            m.appendReplacement(out, Matcher.quoteReplacement(replacement));
        }
        m.appendTail(out);
        return out.toString().replace("&colon;", ":").replace("&Tab;", "\t").replace("&NewLine;", "\n");
    }
}
