package com.prowise.operator;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "platform_operators")
public class PlatformOperatorEntity {

    @Id
    @Column(name = "id", length = 64)
    private String id;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Column(name = "email", nullable = false, length = 320)
    private String email;

    @Column(name = "role_id", nullable = false, length = 64)
    private String roleId = "role-platform-operator";

    @Enumerated(EnumType.STRING)
    @Column(name = "access_level", nullable = false, length = 40)
    private OperatorAccessLevel accessLevel = OperatorAccessLevel.DEPARTMENT_OPERATOR;

    @Column(name = "department_id", length = 64)
    private String departmentId;

    @Column(name = "status", nullable = false, length = 30)
    private String status = "ACTIVE";

    @Column(name = "mfa_enabled", nullable = false)
    private boolean mfaEnabled = true;

    @Column(name = "on_call", nullable = false)
    private boolean onCall = false;

    @Column(name = "shift_name", nullable = false, length = 100)
    private String shiftName = "Americas Primary (08:00 - 17:00)";

    @Column(name = "last_active_at", nullable = false)
    private Instant lastActiveAt = Instant.now();

    @Column(name = "password_hash")
    private String passwordHash;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    @Column(name = "password_setup_completed", nullable = false)
    private boolean passwordSetupCompleted = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public PlatformOperatorEntity() {}

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getRoleId() {
        return roleId;
    }

    public void setRoleId(String roleId) {
        this.roleId = roleId;
    }

    public OperatorAccessLevel getAccessLevel() {
        return accessLevel;
    }

    public void setAccessLevel(OperatorAccessLevel accessLevel) {
        this.accessLevel = accessLevel != null ? accessLevel : OperatorAccessLevel.DEPARTMENT_OPERATOR;
    }

    public String getDepartmentId() {
        return departmentId;
    }

    public void setDepartmentId(String departmentId) {
        this.departmentId = departmentId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public boolean isMfaEnabled() {
        return mfaEnabled;
    }

    public void setMfaEnabled(boolean mfaEnabled) {
        this.mfaEnabled = mfaEnabled;
    }

    public boolean isOnCall() {
        return onCall;
    }

    public void setOnCall(boolean onCall) {
        this.onCall = onCall;
    }

    public String getShiftName() {
        return shiftName;
    }

    public void setShiftName(String shiftName) {
        this.shiftName = shiftName;
    }

    public Instant getLastActiveAt() {
        return lastActiveAt;
    }

    public void setLastActiveAt(Instant lastActiveAt) {
        this.lastActiveAt = lastActiveAt;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public Instant getLastLoginAt() {
        return lastLoginAt;
    }

    public void setLastLoginAt(Instant lastLoginAt) {
        this.lastLoginAt = lastLoginAt;
    }

    public boolean isPasswordSetupCompleted() {
        return passwordSetupCompleted;
    }

    public void setPasswordSetupCompleted(boolean passwordSetupCompleted) {
        this.passwordSetupCompleted = passwordSetupCompleted;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
