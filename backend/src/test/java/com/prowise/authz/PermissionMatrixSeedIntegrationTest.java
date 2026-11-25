package com.prowise.authz;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Least privilege at the source: the seeded role templates equal docs/permission-matrix.md exactly
 * (ALLOW and CONDITIONAL rows hold the key; conditions are enforced by scoped grants and object checks),
 * Platform Operator holds no tenant key, and the permission keys equal docs/permissions.md.
 */
@SpringBootTest
@Tag("T04")
@Tag("NFR-06")
class PermissionMatrixSeedIntegrationTest {

    private static final Path DOCS = Path.of("..", "docs");
    private static final Map<String, String> ROLE_NAMES = Map.of(
            "Organization Owner", "ORGANIZATION_OWNER",
            "Organization Admin", "ORGANIZATION_ADMIN",
            "Project Manager", "PROJECT_MANAGER",
            "Team Lead", "TEAM_LEAD",
            "Developer", "DEVELOPER",
            "QA / Reviewer", "QA_REVIEWER",
            "Viewer / Stakeholder", "VIEWER",
            "Platform Operator", "PLATFORM_OPERATOR",
            "Project Approver (project-scoped)", "PROJECT_APPROVER",
            "Project Repository Manager (project-scoped)", "PROJECT_REPO_MANAGER");

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void seededTemplatesEqualThePermissionMatrix() throws Exception {
        Map<String, Set<String>> expected = matrix();
        assertThat(expected).hasSize(10);
        for (Map.Entry<String, Set<String>> role : expected.entrySet()) {
            Set<String> seeded = new TreeSet<>(jdbc.queryForList("""
                    SELECT rp.permission_key FROM role_permissions rp JOIN roles r ON r.id = rp.role_id
                    WHERE r.is_template AND r.name = ?
                    """, String.class, role.getKey()));
            assertThat(seeded).as(role.getKey()).isEqualTo(role.getValue());
        }
        assertThat(expected.get("PLATFORM_OPERATOR")).isEmpty();
    }

    @Test
    void permissionKeysEqualThePermissionsDocument() throws Exception {
        String doc = Files.readString(DOCS.resolve("permissions.md"));
        String keysSection = doc.substring(doc.indexOf("## Permission keys"), doc.indexOf("## Enforcement rules"));
        Set<String> documented = new TreeSet<>();
        Matcher matcher = Pattern.compile("`([a-z]+(?:\\.[a-z]+)+)`").matcher(keysSection);
        while (matcher.find()) {
            documented.add(matcher.group(1));
        }
        Set<String> implemented = Arrays.stream(PermissionKey.values()).map(PermissionKey::value)
                .collect(Collectors.toCollection(TreeSet::new));
        assertThat(implemented).isEqualTo(documented);

        Set<String> seededKeys = new TreeSet<>(jdbc.queryForList("SELECT DISTINCT permission_key FROM role_permissions "
                + "rp JOIN roles r ON r.id = rp.role_id WHERE r.is_template", String.class));
        assertThat(documented).containsAll(seededKeys);
    }

    private static Map<String, Set<String>> matrix() throws Exception {
        List<String> rows = Files.readAllLines(DOCS.resolve("permission-matrix.md")).stream()
                .filter(line -> line.startsWith("|"))
                .toList();
        List<String> header = cells(rows.get(0));
        Map<String, Set<String>> result = new HashMap<>();
        for (String row : rows.subList(2, rows.size())) {
            List<String> cells = cells(row);
            String role = ROLE_NAMES.get(cells.get(0));
            Set<String> keys = new TreeSet<>();
            for (int i = 1; i < cells.size(); i++) {
                if (cells.get(i).startsWith("ALLOW") || cells.get(i).startsWith("CONDITIONAL")) {
                    keys.add(header.get(i));
                }
            }
            result.put(role, keys);
        }
        return result;
    }

    private static List<String> cells(String row) {
        String trimmed = row.trim();
        return Arrays.stream(trimmed.substring(1, trimmed.length() - 1).split("\\|")).map(String::trim).toList();
    }
}
