package com.prowise.superadmin.policies;

import java.time.Instant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "platform_branding")
public class PlatformBrandingEntity {

    /** Optimistic lock (V34): exposed as "version", checked against the client's expected_version. */
    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id = "branding-default";

    @Column(name = "platform_name", nullable = false, length = 100)
    private String platformName = "ProWise Delivery Cloud";

    @Column(name = "support_email", nullable = false, length = 320)
    private String supportEmail = "support@prowise.io";

    @Column(name = "status_page_url", nullable = false, length = 255)
    private String statusPageUrl = "https://status.prowise.io";

    @Column(name = "default_timezone", nullable = false, length = 100)
    private String defaultTimezone = "UTC";

    @Column(name = "default_language", nullable = false, length = 50)
    private String defaultLanguage = "English (US)";

    @Column(name = "date_format", nullable = false, length = 40)
    private String dateFormat = "MMM DD, YYYY";

    @Column(name = "currency_display", nullable = false, length = 30)
    private String currencyDisplay = "USD ($)";

    @Column(name = "compact_density", nullable = false)
    private Boolean compactDensity = false;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public PlatformBrandingEntity() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getPlatformName() { return platformName; }
    public void setPlatformName(String platformName) { this.platformName = platformName; }

    public String getSupportEmail() { return supportEmail; }
    public void setSupportEmail(String supportEmail) { this.supportEmail = supportEmail; }

    public String getStatusPageUrl() { return statusPageUrl; }
    public void setStatusPageUrl(String statusPageUrl) { this.statusPageUrl = statusPageUrl; }

    public String getDefaultTimezone() { return defaultTimezone; }
    public void setDefaultTimezone(String defaultTimezone) { this.defaultTimezone = defaultTimezone; }

    public String getDefaultLanguage() { return defaultLanguage; }
    public void setDefaultLanguage(String defaultLanguage) { this.defaultLanguage = defaultLanguage; }

    public String getDateFormat() { return dateFormat; }
    public void setDateFormat(String dateFormat) { this.dateFormat = dateFormat; }

    public String getCurrencyDisplay() { return currencyDisplay; }
    public void setCurrencyDisplay(String currencyDisplay) { this.currencyDisplay = currencyDisplay; }

    public Boolean getCompactDensity() { return compactDensity; }
    public void setCompactDensity(Boolean compactDensity) { this.compactDensity = compactDensity; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
}
