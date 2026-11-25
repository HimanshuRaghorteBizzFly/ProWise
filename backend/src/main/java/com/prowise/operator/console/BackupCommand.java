package com.prowise.operator.console;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Builds the pg_dump invocation from the datasource settings. The password is never part of the command
 * line: it goes to the child process only through the PGPASSWORD environment variable.
 */
final class BackupCommand {

    private static final Pattern JDBC_URL =
            Pattern.compile("jdbc:postgresql://([^/:?,]+)(?::(\\d+))?/([^?;]+).*", Pattern.CASE_INSENSITIVE);

    record Target(String host, int port, String database) {}

    private BackupCommand() {}

    /** Single-host jdbc:postgresql URL only; anything else is refused (null). */
    static Target parse(String jdbcUrl) {
        if (jdbcUrl == null) return null;
        Matcher m = JDBC_URL.matcher(jdbcUrl.trim());
        if (!m.matches()) return null;
        int port = m.group(2) == null ? 5432 : Integer.parseInt(m.group(2));
        return new Target(m.group(1), port, m.group(3));
    }

    static List<String> arguments(String pgDump, Target target, String username, Path outputFile) {
        List<String> args = new ArrayList<>();
        args.add(pgDump);
        args.add("--host=" + target.host());
        args.add("--port=" + target.port());
        args.add("--username=" + username);
        args.add("--dbname=" + target.database());
        args.add("--format=custom");
        args.add("--no-password");
        args.add("--file=" + outputFile.toString());
        return args;
    }

    /** PROWISE_PG_DUMP_PATH when set, otherwise pg_dump(.exe) found on PATH; null when neither exists. */
    static String resolvePgDump(String configured, String pathVariable) {
        if (configured != null && !configured.isBlank()) {
            Path p = Path.of(configured.trim());
            return Files.isRegularFile(p) ? p.toString() : null;
        }
        if (pathVariable == null) return null;
        boolean windows = System.getProperty("os.name", "").toLowerCase(Locale.ROOT).contains("win");
        for (String dir : pathVariable.split(File.pathSeparator)) {
            if (dir.isBlank()) continue;
            Path candidate = Path.of(dir.trim(), windows ? "pg_dump.exe" : "pg_dump");
            if (Files.isRegularFile(candidate)) return candidate.toString();
        }
        return null;
    }

    /** First meaningful stderr line, with the password and any path to the backup directory removed. */
    static String safeError(String stderr, String password, String backupDir) {
        if (stderr == null || stderr.isBlank()) return "pg_dump failed without a message.";
        String text = stderr.strip();
        if (password != null && !password.isEmpty()) text = text.replace(password, "***");
        if (backupDir != null && !backupDir.isBlank()) text = text.replace(backupDir, "<backup-dir>");
        text = text.replaceAll("(?i)(password\\s*[=:]\\s*)\\S+", "$1***");
        String first = text.lines().filter(l -> !l.isBlank()).findFirst().orElse(text);
        return first.length() > 480 ? first.substring(0, 480) : first;
    }
}
