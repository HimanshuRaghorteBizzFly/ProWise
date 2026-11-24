package com.prowise.operator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;
import com.prowise.testsupport.ConsoleSessions;

/**
 * Regression: every versioned operator write returns the committed version, so a second edit made with the
 * version returned by the first succeeds (no false 409 STALE_VERSION) for tickets, access requests,
 * maintenance windows and incidents.
 */
@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Tag("NFR-06")
class OperatorVersionedWriteRegressionTest {

    @Autowired private MockMvc mvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder encoder;
    @Autowired private ObjectMapper mapper;

    private String main;

    @BeforeEach
    void setUp() throws Exception {
        TestDatabase.clean(jdbc);
        ConsoleSessions.cleanup(jdbc);
        main = ConsoleSessions.operator(mvc, jdbc, encoder, mapper, ConsoleSessions.operatorId("main"),
                "MAIN_PLATFORM_OPERATOR", null);
    }

    @AfterEach
    void tearDown() {
        ConsoleSessions.cleanup(jdbc);
    }

    @Test
    void supportTicketUpdatedTwiceWithTheReturnedVersion() throws Exception {
        jdbc.update("INSERT INTO support_tickets (id, subject, customer_name, customer_email, priority, status, description) "
                + "VALUES ('tkt-vr-1', 'S', 'C', 'c@x.test', 'LOW', 'OPEN', 'd')");
        long v1 = send(patch("/v1/operator/support/tickets/tkt-vr-1"), Map.of("priority", "HIGH", "expected_version", 0));
        long v2 = send(patch("/v1/operator/support/tickets/tkt-vr-1"), Map.of("status", "IN_PROGRESS", "expected_version", v1));
        assertThat(v2).isEqualTo(v1 + 1);
        assertThat(stored("support_tickets", "tkt-vr-1")).isEqualTo(v2);
    }

    @Test
    void accessRequestApprovedThenRejectedWithTheReturnedVersion() throws Exception {
        jdbc.update("INSERT INTO support_access_requests (id, requester_email, reason, status) "
                + "VALUES ('sar-vr-1', 'r@x.test', 'why', 'PENDING_APPROVAL')");
        long v1 = send(post("/v1/operator/support/access-requests/sar-vr-1/approve"), Map.of("expected_version", 0));
        long v2 = send(post("/v1/operator/support/access-requests/sar-vr-1/reject"), Map.of("expected_version", v1));
        assertThat(v2).isEqualTo(v1 + 1);
        assertThat(stored("support_access_requests", "sar-vr-1")).isEqualTo(v2);
    }

    @Test
    void maintenanceWindowUpdatedTwiceWithTheReturnedVersion() throws Exception {
        jdbc.update("INSERT INTO maintenance_windows (id, title, status, scheduled_start, scheduled_end, created_by) "
                + "VALUES ('mw-vr-1', 'M', 'SCHEDULED', now() + interval '1 hour', now() + interval '2 hours', 'x')");
        long v1 = send(patch("/v1/operator/maintenance/mw-vr-1"), Map.of("title", "M2", "expected_version", 0));
        long v2 = send(patch("/v1/operator/maintenance/mw-vr-1"), Map.of("status", "IN_PROGRESS", "expected_version", v1));
        assertThat(v2).isEqualTo(v1 + 1);
        assertThat(stored("maintenance_windows", "mw-vr-1")).isEqualTo(v2);
    }

    @Test
    void incidentUpdatedTwiceWithTheReturnedVersion() throws Exception {
        jdbc.update("INSERT INTO incidents (id, title, severity, status, description) VALUES ('inc-vr-1', 'A', 'SEV_3', 'INVESTIGATING', 'x')");
        long v1 = send(patch("/v1/operator/incidents/inc-vr-1"), Map.of("severity", "SEV_2", "expected_version", 0));
        long v2 = send(patch("/v1/operator/incidents/inc-vr-1"), Map.of("status", "IDENTIFIED", "expected_version", v1));
        assertThat(v2).isEqualTo(v1 + 1);
        assertThat(stored("incidents", "inc-vr-1")).isEqualTo(v2);
    }

    private long send(MockHttpServletRequestBuilder request, Map<String, ?> body) throws Exception {
        String response = mvc.perform(request.header("Authorization", "Bearer " + main).contentType("application/json")
                        .content(mapper.writeValueAsString(new HashMap<>(body))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode json = mapper.readTree(response);
        return json.path("version").asLong(-1);
    }

    private long stored(String table, String id) {
        return jdbc.queryForObject("SELECT version FROM " + table + " WHERE id = ?", Long.class, id);
    }
}
