package com.prowise.operator;

import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "operator_department_permissions")
public class OperatorDepartmentPermissionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "department_id", nullable = false, length = 64)
    private String departmentId;

    @Column(name = "module_key", nullable = false, length = 80)
    private String moduleKey;

    @Column(name = "permission_action", nullable = false, length = 40)
    private String permissionAction;

    public OperatorDepartmentPermissionEntity() {}

    public OperatorDepartmentPermissionEntity(String departmentId, String moduleKey, String permissionAction) {
        this.departmentId = departmentId;
        this.moduleKey = moduleKey;
        this.permissionAction = permissionAction;
    }

    public UUID getId() {
        return id;
    }

    public String getDepartmentId() {
        return departmentId;
    }

    public void setDepartmentId(String departmentId) {
        this.departmentId = departmentId;
    }

    public String getModuleKey() {
        return moduleKey;
    }

    public void setModuleKey(String moduleKey) {
        this.moduleKey = moduleKey;
    }

    public String getPermissionAction() {
        return permissionAction;
    }

    public void setPermissionAction(String permissionAction) {
        this.permissionAction = permissionAction;
    }
}
