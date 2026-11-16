package com.prowise.common.logging;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Masks credentials before anything is written to a log: Authorization/Cookie headers, bearer
 * tokens, password/secret/token/api-key style key-value pairs, webhook signatures, GitHub tokens
 * and JWTs. Errs on the side of over-masking.
 */
public final class SensitiveDataMasker {

    public static final String MASK = "***";

    private static final String SENSITIVE_KEY =
            "[A-Za-z0-9_.-]*(?:password|passwd|pwd|secret|token|api[_-]?key|apikey|credential)[A-Za-z0-9_.-]*";

    private record Rule(Pattern pattern, String replacement) {
    }

    private static final List<Rule> RULES = List.of(
            new Rule(Pattern.compile("(?i)\\b((?:proxy-)?authorization)(\\s*[:=]\\s*)(\"?)[^\"\\r\\n,;}]+"),
                    "$1$2$3" + MASK),
            new Rule(Pattern.compile("(?i)\\b(set-cookie|cookie)(\\s*[:=]\\s*)[^\\r\\n]+"), "$1$2" + MASK),
            new Rule(Pattern.compile("(?i)\\b(bearer)\\s+[A-Za-z0-9\\-._~+/]+=*"), "$1 " + MASK),
            new Rule(Pattern.compile("(?i)(\"?\\b" + SENSITIVE_KEY + "\"?)(\\s*[:=]\\s*)(\"?)[^\"\\s,;&}]+"),
                    "$1$2$3" + MASK),
            new Rule(Pattern.compile("(?i)\\bsha(?:1|256)=[0-9a-f]{40,64}"), "sha256=" + MASK),
            new Rule(Pattern.compile("\\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}"), MASK),
            new Rule(Pattern.compile("\\beyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+"), MASK));

    private SensitiveDataMasker() {
    }

    public static String mask(String text) {
        if (text == null || text.isEmpty()) {
            return text;
        }
        String result = text;
        for (Rule rule : RULES) {
            result = rule.pattern().matcher(result).replaceAll(rule.replacement());
        }
        return result;
    }
}
