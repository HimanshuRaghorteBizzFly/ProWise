package com.prowise.calendar;

import java.time.Instant;
import java.util.UUID;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "org_calendar")
public class OrgCalendarEntity {

    @Id
    @Column(name = "org_id", nullable = false)
    private UUID orgId;

    @Column(name = "workdays", nullable = false, length = 64)
    private String workdays = "MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "holidays", nullable = false, columnDefinition = "jsonb")
    private String holidays = "[]";

    @Column(name = "timezone", nullable = false, length = 64)
    private String timezone = "UTC";

    @Column(name = "default_cadence", nullable = false, length = 20)
    private String defaultCadence = "WEEKLY";

    @Column(name = "default_cutoff_time", nullable = false, length = 8)
    private String defaultCutoffTime = "17:00";

    @Column(name = "default_grace_working_days", nullable = false)
    private int defaultGraceWorkingDays = 1;

    @Version
    @Column(name = "version", nullable = false)
    private Long version = 0L;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public OrgCalendarEntity() {}

    public OrgCalendarEntity(UUID orgId) {
        this.orgId = orgId;
    }

    public UUID getOrgId() { return orgId; }
    public void setOrgId(UUID orgId) { this.orgId = orgId; }

    public String getWorkdays() { return workdays; }
    public void setWorkdays(String workdays) { this.workdays = workdays; }

    public String getHolidays() { return holidays; }
    public void setHolidays(String holidays) { this.holidays = holidays; }

    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }

    public String getDefaultCadence() { return defaultCadence; }
    public void setDefaultCadence(String defaultCadence) { this.defaultCadence = defaultCadence; }

    public String getDefaultCutoffTime() { return defaultCutoffTime; }
    public void setDefaultCutoffTime(String defaultCutoffTime) { this.defaultCutoffTime = defaultCutoffTime; }

    public int getDefaultGraceWorkingDays() { return defaultGraceWorkingDays; }
    public void setDefaultGraceWorkingDays(int defaultGraceWorkingDays) { this.defaultGraceWorkingDays = defaultGraceWorkingDays; }

    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
