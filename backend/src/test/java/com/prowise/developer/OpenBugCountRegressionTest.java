package com.prowise.developer;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import com.prowise.authz.TestDatabase;

/** Regression: the developer dashboard's open bug count excludes every terminal status (RESOLVED and CLOSED). */
@SpringBootTest
class OpenBugCountRegressionTest {

    @Autowired private JdbcTemplate jdbc;
    @Autowired private BugRepository bugs;

    @BeforeEach
    void clean() {
        TestDatabase.clean(jdbc);
    }

    @Test
    void closedAndResolvedBugsAreNotOpen() {
        UUID org = UUID.randomUUID();
        UUID dev = UUID.randomUUID();
        jdbc.update("INSERT INTO organizations (id, name, slug, timezone) VALUES (?, 'Bug Org', ?, 'UTC')", org, "bug-" + org);
        jdbc.update("INSERT INTO users (id, email, password_hash, name, status) VALUES (?, ?, 'x', 'Dev', 'ACTIVE')",
                dev, "dev-" + dev + "@bugs.test");
        jdbc.update("INSERT INTO memberships (id, org_id, user_id, role_template) VALUES (?, ?, ?, 'DEVELOPER')",
                UUID.randomUUID(), org, dev);
        String project = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO projects (id, org_id, key, name, mode, member_ids, accountable_owner_id) "
                + "VALUES (?, ?, 'BUG', 'Bugs', 'STRUCTURED', ?, ?)", project, org, dev.toString(), dev.toString());
        String[] statuses = {"OPEN", "IN_PROGRESS", "REOPENED", "RESOLVED", "CLOSED"};
        for (String s : statuses) {
            jdbc.update("INSERT INTO bugs (id, project_id, org_id, title, description, status, assigned_developer_id) "
                    + "VALUES (?, ?, ?, 't', 'd', ?, ?)", "bug-" + UUID.randomUUID(), project, org, s, dev.toString());
        }
        // Another developer's open bug is not counted.
        jdbc.update("INSERT INTO bugs (id, project_id, org_id, title, description, status, assigned_developer_id) "
                + "VALUES (?, ?, ?, 't', 'd', 'OPEN', 'someone-else')", "bug-" + UUID.randomUUID(), project, org);

        assertThat(bugs.countOpenAssigned(org, dev.toString())).isEqualTo(3);
    }
}
