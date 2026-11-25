package com.prowise.integration.github;

import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Finds task keys of one project (e.g. {@code PRW-12}) in a commit message, branch name or pull request title.
 * Pure Java, no Spring. Matching is case-insensitive and needs a word boundary on both sides, so {@code PRW-1} never
 * matches inside {@code PRW-12} or {@code XPRW-1}. The result is only evidence; it never sets completion.
 */
public final class TaskKeyMatcher {

    private final String projectKey;
    private final Pattern taskKey;
    private final Pattern projectMention;

    public TaskKeyMatcher(String projectKey) {
        this.projectKey = projectKey.toUpperCase(Locale.ROOT);
        String quoted = Pattern.quote(this.projectKey);
        this.taskKey = Pattern.compile("(?<![A-Za-z0-9])" + quoted + "-([0-9]{1,9})(?![0-9])", Pattern.CASE_INSENSITIVE);
        this.projectMention = Pattern.compile("(?<![A-Za-z0-9])" + quoted + "(?![A-Za-z0-9])", Pattern.CASE_INSENSITIVE);
    }

    /** Task keys found in {@code text}, upper-cased, in order of appearance, without duplicates. */
    public Set<String> taskKeys(String text) {
        Set<String> keys = new LinkedHashSet<>();
        if (text == null || text.isEmpty()) return keys;
        Matcher matcher = taskKey.matcher(text);
        while (matcher.find()) keys.add(projectKey + "-" + Integer.parseInt(matcher.group(1)));
        return keys;
    }

    /** Whether the project key itself is mentioned (used for Solo projects, which have no tasks). */
    public boolean mentionsProject(String text) {
        return text != null && (projectMention.matcher(text).find() || !taskKeys(text).isEmpty());
    }
}
