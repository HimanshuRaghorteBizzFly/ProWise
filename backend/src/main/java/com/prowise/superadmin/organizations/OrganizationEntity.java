package com.prowise.superadmin.organizations;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "organizations")
public class OrganizationEntity {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Column(name = "slug", nullable = false, unique = true, length = 100)
    private String slug;

    @Column(name = "domain", length = 255)
    private String domain;

    @Column(name = "industry", length = 120)
    private String industry;

    @Column(name = "country", length = 100)
    private String country;

    @Column(name = "timezone", nullable = false, length = 100)
    private String timezone = "UTC";

    @Column(name = "owner_name", length = 200)
    private String ownerName;

    @Column(name = "owner_email", length = 320)
    private String ownerEmail;

    @Column(name = "state", nullable = false, length = 30)
    private String state = "ACTIVE"; // ACTIVE, SUSPENDED, ARCHIVED

    @Column(name = "plan_id", length = 64)
    private String planId = "plan-starter";

    @Column(name = "seats_limit")
    private Integer seatsLimit = 25;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "suspended_reason", columnDefinition = "TEXT")
    private String suspendedReason;

    @Version
    @Column(name = "version", nullable = false)
    private Long version = 0L;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public OrganizationEntity() {}

    public OrganizationEntity(UUID id, String name, String slug, String timezone) {
        this.id = id;
        this.name = name;
        this.slug = slug;
        this.timezone = timezone;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }

    public String getDomain() { return domain; }
    public void setDomain(String domain) { this.domain = domain; }

    public String getIndustry() { return industry; }
    public void setIndustry(String industry) { this.industry = industry; }

    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }

    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }

    public String getOwnerName() { return ownerName; }
    public void setOwnerName(String ownerName) { this.ownerName = ownerName; }

    public String getOwnerEmail() { return ownerEmail; }
    public void setOwnerEmail(String ownerEmail) { this.ownerEmail = ownerEmail; }

    public String getState() { return state; }
    public void setState(String state) { this.state = state; }

    public String getPlanId() { return planId; }
    public void setPlanId(String planId) { this.planId = planId; }

    public Integer getSeatsLimit() { return seatsLimit; }
    public void setSeatsLimit(Integer seatsLimit) { this.seatsLimit = seatsLimit; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public String getSuspendedReason() { return suspendedReason; }
    public void setSuspendedReason(String suspendedReason) { this.suspendedReason = suspendedReason; }

    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
