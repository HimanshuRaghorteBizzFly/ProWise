package com.prowise.superadmin.plans;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "plans")
public class PlanEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "code", nullable = false, unique = true, length = 64)
    private String code;

    @Column(name = "name", nullable = false, length = 120)
    private String name;

    @Column(name = "tagline", length = 255)
    private String tagline;

    @Column(name = "monthly_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal monthlyPrice = BigDecimal.ZERO;

    @Column(name = "annual_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal annualPrice = BigDecimal.ZERO;

    @Column(name = "currency", nullable = false, length = 10)
    private String currency = "USD";

    @Column(name = "status", nullable = false, length = 30)
    private String status = "ACTIVE"; // ACTIVE, ARCHIVED

    @Column(name = "is_popular", nullable = false)
    private boolean isPopular = false;

    @Column(name = "badge_label", length = 64)
    private String badgeLabel;

    @Column(name = "brand_color", length = 30)
    private String brandColor = "blue";

    @Column(name = "ai_token_quota", length = 64)
    private String aiTokenQuota;

    @Column(name = "trial_days", nullable = false)
    private int trialDays = 14;

    @Column(name = "max_seats", nullable = false)
    private int maxSeats = 10;

    @Column(name = "max_projects", nullable = false)
    private int maxProjects = 5;

    @Column(name = "max_workspaces", nullable = false)
    private int maxWorkspaces = 1;

    @Column(name = "storage_gb", nullable = false)
    private int storageGb = 10;

    @Column(name = "api_rate_limit_per_min", nullable = false)
    private int apiRateLimitPerMin = 300;

    @Version
    @Column(name = "version", nullable = false)
    private Long version = 0L;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @OneToMany(mappedBy = "plan", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("sortOrder ASC")
    private List<PlanFeatureEntity> features = new ArrayList<>();

    public PlanEntity() {}

    public PlanEntity(String id, String code, String name) {
        this.id = id;
        this.code = code;
        this.name = name;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getTagline() { return tagline; }
    public void setTagline(String tagline) { this.tagline = tagline; }

    public BigDecimal getMonthlyPrice() { return monthlyPrice; }
    public void setMonthlyPrice(BigDecimal monthlyPrice) { this.monthlyPrice = monthlyPrice; }

    public BigDecimal getAnnualPrice() { return annualPrice; }
    public void setAnnualPrice(BigDecimal annualPrice) { this.annualPrice = annualPrice; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public boolean isPopular() { return isPopular; }
    public void setPopular(boolean popular) { isPopular = popular; }

    public String getBadgeLabel() { return badgeLabel; }
    public void setBadgeLabel(String badgeLabel) { this.badgeLabel = badgeLabel; }

    public String getBrandColor() { return brandColor; }
    public void setBrandColor(String brandColor) { this.brandColor = brandColor; }

    public String getAiTokenQuota() { return aiTokenQuota; }
    public void setAiTokenQuota(String aiTokenQuota) { this.aiTokenQuota = aiTokenQuota; }

    public int getTrialDays() { return trialDays; }
    public void setTrialDays(int trialDays) { this.trialDays = trialDays; }

    public int getMaxSeats() { return maxSeats; }
    public void setMaxSeats(int maxSeats) { this.maxSeats = maxSeats; }

    public int getMaxProjects() { return maxProjects; }
    public void setMaxProjects(int maxProjects) { this.maxProjects = maxProjects; }

    public int getMaxWorkspaces() { return maxWorkspaces; }
    public void setMaxWorkspaces(int maxWorkspaces) { this.maxWorkspaces = maxWorkspaces; }

    public int getStorageGb() { return storageGb; }
    public void setStorageGb(int storageGb) { this.storageGb = storageGb; }

    public int getApiRateLimitPerMin() { return apiRateLimitPerMin; }
    public void setApiRateLimitPerMin(int apiRateLimitPerMin) { this.apiRateLimitPerMin = apiRateLimitPerMin; }

    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public List<PlanFeatureEntity> getFeatures() { return features; }
    public void setFeatures(List<PlanFeatureEntity> features) { this.features = features; }
}
