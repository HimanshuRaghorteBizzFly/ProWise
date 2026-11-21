package com.prowise.org;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;
import com.prowise.notification.EmailMessage;
import com.prowise.notification.InMemoryEmailSender;

/**
 * Task 1.2 acceptance over HTTP + PostgreSQL: T02 single-use invitations, T03 teams and leads, ownership
 * transfer with exactly one owner, planned handover and emergency disable, append-only history.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Tag("T02")
@Tag("T03")
class PeopleManagementIntegrationTest {

    static final UUID ADMIN = UUID.fromString("10000000-0000-0000-0000-000000000002");
    static final UUID PROJECT_MANAGER = UUID.fromString("10000000-0000-0000-0000-000000000003");
    static final UUID DEVELOPER = UUID.fromString("10000000-0000-0000-0000-000000000005");
    static final UUID VIEWER = UUID.fromString("10000000-0000-0000-0000-000000000007");
    private static final Pattern LINK_TOKEN = Pattern.compile("#token=([A-Za-z0-9_-]+)");

    @TestConfiguration
    static class Mail {
        @Bean
        @Primary
        InMemoryEmailSender inMemoryEmailSender() {
            return new InMemoryEmailSender();
        }
    }

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private InMemoryEmailSender mail;

    @BeforeEach
    @AfterEach
    void clean() {
        TestDatabase.clean(jdbc);
        mail.clear();
    }

    /* ================================================================== T02: invitations */

    @Test
    void invitationIsAcceptedOnceAndTheTokenIsNeverExposed() throws Exception {
        Org org = organization("t02");
        Person invitee = person("invitee");
        MvcResult created = mockMvc.perform(auth(post("/v1/organizations/{org}/invitations", org.id()), org.token())
                        .contentType("application/json").content(inviteBody(invitee.email(), DEVELOPER)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andReturn();
        String token = tokenFor(invitee.email());
        String createdBody = created.getResponse().getContentAsString();
        assertThat(createdBody).doesNotContain(token).doesNotContainIgnoringCase("token");
        String listBody = mockMvc.perform(auth(get("/v1/organizations/{org}/invitations", org.id()), org.token()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(listBody).doesNotContain(token).doesNotContainIgnoringCase("token");
        assertThat(jdbc.queryForObject("SELECT token_hash FROM invitations", String.class)).isNotEqualTo(token).hasSize(64);

        mockMvc.perform(auth(post("/v1/invitations/preview"), invitee.token()).contentType("application/json")
                        .content(tokenBody(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role_name").value("DEVELOPER"));
        mockMvc.perform(auth(post("/v1/invitations/accept"), invitee.token()).contentType("application/json")
                        .content(tokenBody(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.organization_id").value(org.id().toString()));

        // Replay: no second membership, the link is spent.
        mockMvc.perform(auth(post("/v1/invitations/accept"), invitee.token()).contentType("application/json")
                        .content(tokenBody(token)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("INVITATION_INVALID"));
        assertThat(memberships(org.id(), invitee.id())).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM membership_history WHERE org_id = ? AND change_type = 'JOINED'", org.id()))
                .isEqualTo(1);
        assertThat(count("SELECT count(*) FROM audit_log WHERE org_id = ? AND action = 'invitation.accepted'", org.id()))
                .isEqualTo(1);
        // The new member reaches the workspace with the invited role.
        String memberToken = switchTo(invitee.token(), org.id());
        mockMvc.perform(auth(get("/v1/me/permissions").param("org", org.id().toString()), memberToken))
                .andExpect(status().isOk());
    }

    @Test
    void expiredRevokedAndSupersededInvitationsGrantNothing() throws Exception {
        Org org = organization("t02-dead");
        Person expired = person("expired");
        Person revoked = person("revoked");
        Person rotated = person("rotated");
        invite(org, expired.email(), DEVELOPER);
        String expiredToken = tokenFor(expired.email());
        jdbc.update("UPDATE invitations SET expires_at = now() - interval '1 minute' WHERE lower(email) = ?", expired.email());

        JsonNode toRevoke = invite(org, revoked.email(), DEVELOPER);
        String revokedToken = tokenFor(revoked.email());
        mockMvc.perform(auth(post("/v1/organizations/{org}/invitations/{id}/revoke", org.id(), toRevoke.path("id").asText()),
                        org.token()).contentType("application/json").content(version(toRevoke)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REVOKED"));

        JsonNode toRotate = invite(org, rotated.email(), DEVELOPER);
        String oldToken = tokenFor(rotated.email());
        mail.clear();
        mockMvc.perform(auth(post("/v1/organizations/{org}/invitations/{id}/resend", org.id(), toRotate.path("id").asText()),
                        org.token()).contentType("application/json").content(version(toRotate)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.send_count").value(2));
        String newToken = tokenFor(rotated.email());
        assertThat(newToken).isNotEqualTo(oldToken);

        assertInvalid(expired, expiredToken);
        assertInvalid(revoked, revokedToken);
        assertInvalid(rotated, oldToken);
        assertThat(memberships(org.id(), expired.id()) + memberships(org.id(), revoked.id())
                + memberships(org.id(), rotated.id())).isZero();

        mockMvc.perform(auth(post("/v1/invitations/accept"), rotated.token()).contentType("application/json")
                .content(tokenBody(newToken))).andExpect(status().isOk());
        // A stale resend (old version) and a revoke of an accepted invitation are refused.
        mockMvc.perform(auth(post("/v1/organizations/{org}/invitations/{id}/revoke", org.id(), toRotate.path("id").asText()),
                        org.token()).contentType("application/json").content(version(toRotate)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STALE_VERSION"));
    }

    @Test
    void twoSimultaneousAcceptsCreateExactlyOneMembership() throws Exception {
        Org org = organization("t02-race");
        Person invitee = person("racer");
        invite(org, invitee.email(), DEVELOPER);
        String token = tokenFor(invitee.email());

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Integer>> runs = new ArrayList<>();
        for (int i = 0; i < 2; i++) {
            Callable<Integer> accept = () -> {
                start.await();
                return mockMvc.perform(auth(post("/v1/invitations/accept"), invitee.token())
                        .contentType("application/json").content(tokenBody(token))).andReturn().getResponse().getStatus();
            };
            runs.add(pool.submit(accept));
        }
        start.countDown();
        List<Integer> statuses = new ArrayList<>();
        for (Future<Integer> run : runs) statuses.add(run.get(60, TimeUnit.SECONDS));
        pool.shutdown();

        assertThat(statuses).containsExactlyInAnyOrder(200, 404);
        assertThat(memberships(org.id(), invitee.id())).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM grants WHERE org_id = ? AND template_role_id = ?", org.id(), DEVELOPER))
                .isEqualTo(1);
    }

    @Test
    void invitationForAnotherEmailIsRefusedWithoutDetail() throws Exception {
        Org org = organization("t02-email");
        Person invitee = person("right");
        Person stranger = person("wrong");
        invite(org, invitee.email(), DEVELOPER);
        String token = tokenFor(invitee.email());

        assertInvalid(stranger, token);
        mockMvc.perform(auth(post("/v1/invitations/preview"), stranger.token()).contentType("application/json")
                .content(tokenBody(token))).andExpect(status().isNotFound());
        assertInvalid(stranger, "not-a-real-token");
        assertThat(memberships(org.id(), stranger.id())).isZero();
        mockMvc.perform(post("/v1/invitations/accept").contentType("application/json").content(tokenBody(token)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void foreignOrganizationInvitationIsNotFound() throws Exception {
        Org orgA = organization("t02-a");
        Org orgB = organization("t02-b");
        JsonNode invitation = invite(orgA, "someone-" + UUID.randomUUID().toString().substring(0, 6) + "@example.test", VIEWER);
        String id = invitation.path("id").asText();

        // B's owner addresses A's invitation through B's path and through A's path: nothing is revealed.
        mockMvc.perform(auth(get("/v1/organizations/{org}/invitations/{id}", orgB.id(), id), orgB.token()))
                .andExpect(status().isNotFound());
        mockMvc.perform(auth(post("/v1/organizations/{org}/invitations/{id}/revoke", orgB.id(), id), orgB.token())
                .contentType("application/json").content(version(invitation))).andExpect(status().isNotFound());
        mockMvc.perform(auth(get("/v1/organizations/{org}/invitations", orgA.id()), orgB.token()))
                .andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("SELECT status FROM invitations WHERE id = ?::uuid", String.class, id))
                .isEqualTo("PENDING");
    }

    @Test
    void adminCannotInviteOrGrantAboveOwnPowers() throws Exception {
        Org org = organization("t02-admin");
        Person admin = person("admin");
        UUID adminMembership = member(org.id(), admin.id(), "ORGANIZATION_ADMIN", ADMIN);
        String adminToken = switchTo(admin.token(), org.id());
        Person viewer = person("viewer");
        UUID viewerMembership = member(org.id(), viewer.id(), "VIEWER", VIEWER);

        // Project Manager holds project.edit and more that an Admin does not hold.
        mockMvc.perform(auth(post("/v1/organizations/{org}/invitations", org.id()), adminToken)
                        .contentType("application/json").content(inviteBody("pm-" + UUID.randomUUID().toString().substring(0, 6)
                                + "@example.test", PROJECT_MANAGER)))
                .andExpect(status().isForbidden());
        mockMvc.perform(auth(patch("/v1/organizations/{org}/members/{m}/role", org.id(), viewerMembership), adminToken)
                        .contentType("application/json")
                        .content("{\"template_role_id\":\"" + PROJECT_MANAGER + "\",\"expected_version\":0}"))
                .andExpect(status().isForbidden());
        // Within the Admin's powers both work.
        invite(org, adminToken, "viewer2-" + UUID.randomUUID().toString().substring(0, 6) + "@example.test", VIEWER);
        // Admin cannot transfer ownership.
        mockMvc.perform(auth(post("/v1/organizations/{org}/ownership/transfer", org.id()), adminToken)
                        .contentType("application/json").content(transferBody(adminMembership, org.slug(), 0)))
                .andExpect(status().isForbidden());
        assertThat(jdbc.queryForObject("SELECT role_template FROM memberships WHERE id = ?", String.class, viewerMembership))
                .isEqualTo("VIEWER");
    }

    /* ================================================================== T03: teams */

    @Test
    void teamWithLeadMembersAndForeignIdsRefused() throws Exception {
        Org org = organization("t03");
        Org other = organization("t03-other");
        Person lead = person("lead");
        Person dev = person("dev");
        UUID leadMembership = member(org.id(), lead.id(), "DEVELOPER", DEVELOPER);
        UUID devMembership = member(org.id(), dev.id(), "DEVELOPER", DEVELOPER);
        UUID foreignMembership = jdbc.queryForObject("SELECT id FROM memberships WHERE org_id = ?", UUID.class, other.id());

        // A lead from another organization is refused at creation.
        mockMvc.perform(auth(post("/v1/organizations/{org}/teams", org.id()), org.token()).contentType("application/json")
                        .content("{\"name\":\"Platform\",\"lead_membership_id\":\"" + foreignMembership + "\"}"))
                .andExpect(status().isNotFound());
        assertThat(count("SELECT count(*) FROM teams WHERE org_id = ?", org.id())).isZero();

        JsonNode team = json(mockMvc.perform(auth(post("/v1/organizations/{org}/teams", org.id()), org.token())
                        .contentType("application/json")
                        .content("{\"name\":\"Platform\",\"lead_membership_id\":\"" + leadMembership + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.lead_membership_id").value(leadMembership.toString()))
                .andReturn());
        String teamId = team.path("id").asText();

        team = json(mockMvc.perform(auth(post("/v1/organizations/{org}/teams/{t}/members", org.id(), teamId), org.token())
                        .contentType("application/json").content(memberBody(devMembership, team)))
                .andExpect(status().isOk()).andReturn());
        assertThat(team.path("members")).hasSize(2);
        mockMvc.perform(auth(post("/v1/organizations/{org}/teams/{t}/members", org.id(), teamId), org.token())
                        .contentType("application/json").content(memberBody(foreignMembership, team)))
                .andExpect(status().isNotFound());
        mockMvc.perform(auth(put("/v1/organizations/{org}/teams/{t}/lead", org.id(), teamId), org.token())
                        .contentType("application/json")
                        .content("{\"lead_membership_id\":\"" + foreignMembership + "\",\"expected_version\":" + team.path("version").asLong() + "}"))
                .andExpect(status().isNotFound());

        // Lead change, then a stale write with the old version.
        long before = team.path("version").asLong();
        team = json(mockMvc.perform(auth(put("/v1/organizations/{org}/teams/{t}/lead", org.id(), teamId), org.token())
                        .contentType("application/json")
                        .content("{\"lead_membership_id\":\"" + devMembership + "\",\"expected_version\":" + before + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lead_membership_id").value(devMembership.toString()))
                .andReturn());
        mockMvc.perform(auth(patch("/v1/organizations/{org}/teams/{t}", org.id(), teamId), org.token())
                        .contentType("application/json").content("{\"name\":\"Core\",\"expected_version\":" + before + "}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STALE_VERSION"));
        assertThat(count("SELECT count(*) FROM ownership_history WHERE org_id = ? AND subject_type = 'TEAM_LEAD'", org.id()))
                .isEqualTo(2);

        // Remove a member, archive, and the archived team is read-only.
        team = json(mockMvc.perform(auth(delete("/v1/organizations/{org}/teams/{t}/members/{m}", org.id(), teamId,
                        leadMembership).param("expectedVersion", team.path("version").asText()), org.token()))
                .andExpect(status().isOk()).andReturn());
        assertThat(team.path("members")).hasSize(1);
        team = json(mockMvc.perform(auth(post("/v1/organizations/{org}/teams/{t}/archive", org.id(), teamId), org.token())
                        .contentType("application/json").content(version(team)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ARCHIVED")).andReturn());
        mockMvc.perform(auth(patch("/v1/organizations/{org}/teams/{t}", org.id(), teamId), org.token())
                        .contentType("application/json").content("{\"name\":\"Again\",\"expected_version\":" + team.path("version").asLong() + "}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TEAM_ARCHIVED"));
        assertThat(count("SELECT count(*) FROM audit_log WHERE org_id = ? AND action LIKE 'team.%'", org.id())).isEqualTo(5);
        // The database itself rejects a team member from another organization.
        assertThatThrownBy(() -> jdbc.update(
                "INSERT INTO team_members (team_id, org_id, membership_id, added_by) VALUES (?::uuid, ?, ?, ?)",
                teamId, org.id(), foreignMembership, org.ownerId())).isInstanceOf(DataAccessException.class);
    }

    /* ================================================================== ownership */

    @Test
    void ownershipTransferKeepsExactlyOneOwnerAndOnlyTheOwnerMayTransfer() throws Exception {
        Org org = organization("own");
        Person next = person("next-owner");
        UUID nextMembership = member(org.id(), next.id(), "ORGANIZATION_ADMIN", ADMIN);
        UUID oldMembership = jdbc.queryForObject("SELECT id FROM memberships WHERE org_id = ? AND user_id = ?", UUID.class,
                org.id(), org.ownerId());
        long version = json(mockMvc.perform(auth(get("/v1/organizations/{org}/ownership", org.id()), org.token()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.caller_is_owner").value(true)).andReturn())
                .path("version").asLong();

        // Missing confirmation is refused.
        mockMvc.perform(auth(post("/v1/organizations/{org}/ownership/transfer", org.id()), org.token())
                        .contentType("application/json").content(transferBody(nextMembership, "wrong-slug", version)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("CONFIRMATION_REQUIRED"));

        mockMvc.perform(auth(post("/v1/organizations/{org}/ownership/transfer", org.id()), org.token())
                        .contentType("application/json").content(transferBody(nextMembership, org.slug(), version)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.owner_membership_id").value(nextMembership.toString()));

        assertThat(count("SELECT count(*) FROM memberships WHERE org_id = ? AND role_template = 'ORGANIZATION_OWNER'", org.id()))
                .isEqualTo(1);
        assertThat(count("SELECT count(*) FROM grants WHERE org_id = ? AND template_role_id = '10000000-0000-0000-0000-000000000001'",
                org.id())).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT role_template FROM memberships WHERE id = ?", String.class, oldMembership))
                .isEqualTo("ORGANIZATION_ADMIN");
        assertThat(count("SELECT count(*) FROM ownership_history WHERE org_id = ? AND change_type = 'TRANSFER'", org.id()))
                .isEqualTo(1);
        assertThat(count("SELECT count(*) FROM membership_history WHERE org_id = ? AND change_type = 'ROLE_CHANGED'", org.id()))
                .isEqualTo(2);

        // The former owner can no longer transfer (no org.manage), the new owner can manage the org.
        mockMvc.perform(auth(post("/v1/organizations/{org}/ownership/transfer", org.id()), org.token())
                        .contentType("application/json").content(transferBody(oldMembership, org.slug(), version + 1)))
                .andExpect(status().isForbidden());
        String newOwnerToken = switchTo(next.token(), org.id());
        mockMvc.perform(auth(get("/v1/organizations/{org}/ownership", org.id()), newOwnerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.caller_is_owner").value(true));
        // A second owner can never be created by a grant either.
        assertThatThrownBy(() -> jdbc.update("UPDATE memberships SET role_template = 'ORGANIZATION_OWNER' WHERE id = ?",
                oldMembership)).isInstanceOf(DataAccessException.class);
    }

    /* ================================================================== departure */

    @Test
    void emergencyDisableWithoutReplacementCutsAccessAndOpensHandoverItems() throws Exception {
        Org org = organization("emergency");
        Person leaver = person("leaver");
        Person backup = person("backup");
        UUID leaverMembership = member(org.id(), leaver.id(), "DEVELOPER", DEVELOPER);
        UUID backupMembership = member(org.id(), backup.id(), "DEVELOPER", DEVELOPER);
        String leaverToken = switchTo(leaver.token(), org.id());
        String teamId = createTeam(org, "Mobile", leaverMembership);
        String projectId = project(org.id(), "Checkout", leaver.id());
        mockMvc.perform(auth(get("/v1/me/permissions").param("org", org.id().toString()), leaverToken))
                .andExpect(status().isOk());

        mockMvc.perform(auth(get("/v1/organizations/{org}/members/{m}/ownership", org.id(), leaverMembership), org.token()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.owned.length()").value(2));
        // Owned work blocks a plain disable.
        mockMvc.perform(auth(patch("/v1/organizations/{org}/members/{m}/status", org.id(), leaverMembership), org.token())
                        .contentType("application/json").content("{\"status\":\"DISABLED\",\"expected_version\":0}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("HANDOVER_REQUIRED"));

        mockMvc.perform(auth(patch("/v1/organizations/{org}/members/{m}/status", org.id(), leaverMembership), org.token())
                        .contentType("application/json")
                        .content("{\"status\":\"DISABLED\",\"emergency\":true,\"reason\":\"Left today\",\"expected_version\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DISABLED"))
                .andExpect(jsonPath("$.open_handover_items.length()").value(2));

        // Immediate: the very next request with the leaver's token is refused.
        mockMvc.perform(auth(get("/v1/me/permissions").param("org", org.id().toString()), leaverToken))
                .andExpect(result -> assertThat(result.getResponse().getStatus()).isIn(401, 404));
        assertThat(count("SELECT count(*) FROM sessions WHERE user_id = ? AND org_id = ? AND revoked_at IS NULL",
                leaver.id(), org.id())).isZero();

        JsonNode items = json(mockMvc.perform(auth(get("/v1/organizations/{org}/handover-items", org.id()), org.token())
                        .param("status", "NEEDS_OWNER")).andExpect(status().isOk()).andReturn());
        assertThat(items).hasSize(2);
        assertThat(jdbc.queryForObject("SELECT lead_membership_id FROM teams WHERE id = ?::uuid", UUID.class, teamId)).isNull();

        // Resolve one item later: the replacement takes over the team lead.
        JsonNode teamItem = null;
        for (JsonNode item : items) if ("TEAM_LEAD".equals(item.path("subject_type").asText())) teamItem = item;
        assertThat(teamItem).isNotNull();
        mockMvc.perform(auth(post("/v1/organizations/{org}/handover-items/{id}/resolve", org.id(), teamItem.path("id").asText()),
                        org.token()).contentType("application/json")
                        .content("{\"replacement_membership_id\":\"" + backupMembership + "\",\"expected_version\":0}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("RESOLVED"));
        assertThat(jdbc.queryForObject("SELECT lead_membership_id FROM teams WHERE id = ?::uuid", UUID.class, teamId))
                .isEqualTo(backupMembership);
        assertThat(jdbc.queryForObject("SELECT accountable_owner_id FROM projects WHERE id = ?", String.class, projectId))
                .isEqualTo(leaver.id().toString()); // still flagged by its open handover item
        assertThat(count("SELECT count(*) FROM membership_history WHERE membership_id = ? AND change_type = 'DISABLED'",
                leaverMembership)).isEqualTo(1);
    }

    @Test
    void plannedHandoverMovesEverythingToTheReplacementAtomically() throws Exception {
        Org org = organization("planned");
        Person leaver = person("planned-leaver");
        Person heir = person("heir");
        UUID leaverMembership = member(org.id(), leaver.id(), "DEVELOPER", DEVELOPER);
        UUID heirMembership = member(org.id(), heir.id(), "DEVELOPER", DEVELOPER);
        String teamId = createTeam(org, "Payments", leaverMembership);
        String projectId = project(org.id(), "Ledger", leaver.id());

        mockMvc.perform(auth(patch("/v1/organizations/{org}/members/{m}/status", org.id(), leaverMembership), org.token())
                        .contentType("application/json")
                        .content("{\"status\":\"DISABLED\",\"replacement_membership_id\":\"" + heirMembership
                                + "\",\"expected_version\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.open_handover_items.length()").value(0));

        assertThat(jdbc.queryForObject("SELECT lead_membership_id FROM teams WHERE id = ?::uuid", UUID.class, teamId))
                .isEqualTo(heirMembership);
        assertThat(jdbc.queryForObject("SELECT accountable_owner_id FROM projects WHERE id = ?", String.class, projectId))
                .isEqualTo(heir.id().toString());
        assertThat(count("SELECT count(*) FROM ownership_history WHERE org_id = ? AND change_type = 'HANDOVER'", org.id()))
                .isEqualTo(2);
        assertThat(count("SELECT count(*) FROM handover_items WHERE org_id = ?", org.id())).isZero();
    }

    @Test
    void membershipAndOwnershipHistoryAreAppendOnly() throws Exception {
        Org org = organization("history");
        Person dev = person("history-dev");
        UUID membership = member(org.id(), dev.id(), "DEVELOPER", DEVELOPER);
        createTeam(org, "Data", membership);
        mockMvc.perform(auth(patch("/v1/organizations/{org}/members/{m}/status", org.id(), membership), org.token())
                .contentType("application/json")
                .content("{\"status\":\"DISABLED\",\"emergency\":true,\"expected_version\":0}")).andExpect(status().isOk());
        mockMvc.perform(auth(patch("/v1/organizations/{org}/members/{m}/status", org.id(), membership), org.token())
                .contentType("application/json")
                .content("{\"status\":\"ACTIVE\",\"expected_version\":1}")).andExpect(status().isOk());

        assertThat(count("SELECT count(*) FROM membership_history WHERE membership_id = ?", membership)).isEqualTo(2);
        assertThat(count("SELECT count(*) FROM ownership_history WHERE org_id = ?", org.id())).isEqualTo(2);
        for (String table : List.of("membership_history", "ownership_history")) {
            assertThatThrownBy(() -> jdbc.update("UPDATE " + table + " SET actor_id = NULL WHERE org_id = ?", org.id()))
                    .isInstanceOf(DataAccessException.class).hasMessageContaining("append-only");
            assertThatThrownBy(() -> jdbc.update("DELETE FROM " + table + " WHERE org_id = ?", org.id()))
                    .isInstanceOf(DataAccessException.class).hasMessageContaining("append-only");
        }
    }

    /* ------------------------------------------------------------------ helpers */

    record Person(UUID id, String email, String token) {}

    record Org(UUID id, UUID ownerId, String slug, String token) {}

    private void assertInvalid(Person person, String token) throws Exception {
        mockMvc.perform(auth(post("/v1/invitations/accept"), person.token()).contentType("application/json")
                        .content(tokenBody(token)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("INVITATION_INVALID"));
    }

    private JsonNode invite(Org org, String email, UUID role) throws Exception {
        return invite(org, org.token(), email, role);
    }

    private JsonNode invite(Org org, String token, String email, UUID role) throws Exception {
        return json(mockMvc.perform(auth(post("/v1/organizations/{org}/invitations", org.id()), token)
                        .contentType("application/json").content(inviteBody(email, role)))
                .andExpect(status().isCreated()).andReturn());
    }

    private String tokenFor(String email) {
        List<EmailMessage> sent = mail.sentTo(email);
        assertThat(sent).isNotEmpty();
        Matcher matcher = LINK_TOKEN.matcher(sent.get(sent.size() - 1).textBody());
        assertThat(matcher.find()).isTrue();
        return matcher.group(1);
    }

    private String createTeam(Org org, String name, UUID lead) throws Exception {
        return json(mockMvc.perform(auth(post("/v1/organizations/{org}/teams", org.id()), org.token())
                        .contentType("application/json")
                        .content("{\"name\":\"" + name + "\",\"lead_membership_id\":\"" + lead + "\"}"))
                .andExpect(status().isCreated()).andReturn()).path("id").asText();
    }

    private String project(UUID orgId, String name, UUID owner) {
        String id = UUID.randomUUID().toString();
        jdbc.update("""
                INSERT INTO projects (id, org_id, key, name, mode, member_ids, accountable_owner_id)
                VALUES (?, ?, ?, ?, 'STRUCTURED', ?, ?)
                """, id, orgId, "K" + id.substring(0, 6), name, owner.toString(), owner.toString());
        return id;
    }

    private UUID member(UUID orgId, UUID userId, String template, UUID templateRoleId) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO memberships (id, org_id, user_id, role_template) VALUES (?, ?, ?, ?)", id, orgId, userId, template);
        jdbc.update("""
                INSERT INTO grants (id, org_id, membership_id, template_role_id, scope, granted_by)
                VALUES (?, ?, ?, ?, 'ORG', ?)
                """, UUID.randomUUID(), orgId, id, templateRoleId, userId);
        return id;
    }

    private Org organization(String slug) throws Exception {
        Person owner = person(slug + "-owner");
        String unique = slug + "-" + UUID.randomUUID().toString().substring(0, 6);
        String id = json(mockMvc.perform(auth(post("/v1/organizations"), owner.token()).contentType("application/json")
                        .content("{\"name\":\"" + unique + "\",\"slug\":\"" + unique + "\",\"timezone\":\"Europe/London\","
                                + "\"calendar\":{\"workdays\":[1,2,3,4,5],\"holidays\":[]}}"))
                .andExpect(status().isCreated()).andReturn()).path("id").asText();
        UUID orgId = UUID.fromString(id);
        return new Org(orgId, owner.id(), unique, switchTo(owner.token(), orgId));
    }

    private Person person(String name) throws Exception {
        String email = name + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.test";
        JsonNode signup = json(mockMvc.perform(post("/v1/auth/signup").contentType("application/json")
                        .content("{\"email\":\"" + email + "\",\"password\":\"correct-horse-battery\"}"))
                .andExpect(status().isCreated()).andReturn());
        UUID id = jdbc.queryForObject("SELECT id FROM users WHERE lower(email) = lower(?)", UUID.class, email);
        return new Person(id, email, signup.path("access_token").asText());
    }

    private String switchTo(String token, UUID orgId) throws Exception {
        return json(mockMvc.perform(auth(post("/v1/me/organizations/{org}/switch", orgId), token))
                .andExpect(status().isOk()).andReturn()).path("access_token").asText();
    }

    private int memberships(UUID orgId, UUID userId) {
        return count("SELECT count(*) FROM memberships WHERE org_id = ? AND user_id = ?", orgId, userId);
    }

    private int count(String sql, Object... args) {
        Integer value = jdbc.queryForObject(sql, Integer.class, args);
        return value == null ? 0 : value;
    }

    private static String inviteBody(String email, UUID role) {
        return "{\"email\":\"" + email + "\",\"template_role_id\":\"" + role + "\"}";
    }

    private static String tokenBody(String token) {
        return "{\"token\":\"" + token + "\"}";
    }

    private static String version(JsonNode node) {
        return "{\"expected_version\":" + node.path("version").asLong() + "}";
    }

    private static String memberBody(UUID membership, JsonNode team) {
        return "{\"membership_id\":\"" + membership + "\",\"expected_version\":" + team.path("version").asLong() + "}";
    }

    private static String transferBody(UUID membership, String confirmation, long version) {
        return "{\"new_owner_membership_id\":\"" + membership + "\",\"confirmation\":\"" + confirmation
                + "\",\"expected_version\":" + version + "}";
    }

    private static MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder builder, String token) {
        return builder.header("Authorization", "Bearer " + token);
    }

    private JsonNode json(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

}
