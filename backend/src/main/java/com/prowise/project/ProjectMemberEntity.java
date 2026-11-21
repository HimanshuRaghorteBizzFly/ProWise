package com.prowise.project;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "project_members")
public class ProjectMemberEntity {

    @Id
    @Column(name = "id")
    private UUID id = UUID.randomUUID();

    @Column(name = "org_id", nullable = false)
    private UUID orgId;

    @Column(name = "project_id", nullable = false, length = 64)
    private String projectId;

    @Column(name = "membership_id", nullable = false)
    private UUID membershipId;

    @Column(name = "role", nullable = false, length = 50)
    private String role = "MEMBER";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public ProjectMemberEntity() {}

    public ProjectMemberEntity(UUID orgId, String projectId, UUID membershipId, String role) {
        this.id = UUID.randomUUID();
        this.orgId = orgId;
        this.projectId = projectId;
        this.membershipId = membershipId;
        this.role = role != null ? role : "MEMBER";
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getOrgId() { return orgId; }
    public void setOrgId(UUID orgId) { this.orgId = orgId; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public UUID getMembershipId() { return membershipId; }
    public void setMembershipId(UUID membershipId) { this.membershipId = membershipId; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
