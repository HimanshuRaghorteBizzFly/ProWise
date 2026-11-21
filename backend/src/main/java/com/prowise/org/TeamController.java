package com.prowise.org;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Task 1.2: teams, team members and leads (team.manage). */
@RestController
@RequestMapping("/v1/organizations/{orgId}/teams")
public class TeamController {

    private final TeamService teams;

    public TeamController(TeamService teams) {
        this.teams = teams;
    }

    @GetMapping
    @PreAuthorize("@permissionService.authorize(authentication, #orgId, 'team.manage')")
    List<TeamService.TeamResponse> list(@PathVariable UUID orgId, Authentication authentication) {
        return teams.list(orgId, authentication);
    }

    @GetMapping("/{teamId}")
    @PreAuthorize("@permissionService.authorize(authentication, #orgId, 'team.manage')")
    TeamService.TeamResponse get(@PathVariable UUID orgId, @PathVariable UUID teamId, Authentication authentication) {
        return teams.get(orgId, teamId, authentication);
    }

    @PostMapping
    @PreAuthorize("@permissionService.authorize(authentication, #orgId, 'team.manage')")
    ResponseEntity<TeamService.TeamResponse> create(@PathVariable UUID orgId, Authentication authentication,
            @RequestBody TeamService.TeamRequest request) {
        return ResponseEntity.status(201).body(teams.create(orgId, authentication, request));
    }

    @PatchMapping("/{teamId}")
    @PreAuthorize("@permissionService.authorize(authentication, #orgId, 'team.manage')")
    TeamService.TeamResponse update(@PathVariable UUID orgId, @PathVariable UUID teamId, Authentication authentication,
            @RequestBody TeamService.TeamRequest request) {
        return teams.update(orgId, teamId, authentication, request);
    }

    @PostMapping("/{teamId}/archive")
    @PreAuthorize("@permissionService.authorize(authentication, #orgId, 'team.manage')")
    TeamService.TeamResponse archive(@PathVariable UUID orgId, @PathVariable UUID teamId, Authentication authentication,
            @RequestBody TeamService.VersionRequest request) {
        return teams.archive(orgId, teamId, authentication, request);
    }

    @PostMapping("/{teamId}/members")
    @PreAuthorize("@permissionService.authorize(authentication, #orgId, 'team.manage')")
    TeamService.TeamResponse addMember(@PathVariable UUID orgId, @PathVariable UUID teamId, Authentication authentication,
            @RequestBody TeamService.MemberRequest request) {
        return teams.addMember(orgId, teamId, authentication, request);
    }

    @DeleteMapping("/{teamId}/members/{membershipId}")
    @PreAuthorize("@permissionService.authorize(authentication, #orgId, 'team.manage')")
    TeamService.TeamResponse removeMember(@PathVariable UUID orgId, @PathVariable UUID teamId,
            @PathVariable UUID membershipId, @RequestParam long expectedVersion, Authentication authentication) {
        return teams.removeMember(orgId, teamId, membershipId, expectedVersion, authentication);
    }

    @PutMapping("/{teamId}/lead")
    @PreAuthorize("@permissionService.authorize(authentication, #orgId, 'team.manage')")
    TeamService.TeamResponse changeLead(@PathVariable UUID orgId, @PathVariable UUID teamId,
            Authentication authentication, @RequestBody TeamService.LeadRequest request) {
        return teams.changeLead(orgId, teamId, authentication, request);
    }
}
