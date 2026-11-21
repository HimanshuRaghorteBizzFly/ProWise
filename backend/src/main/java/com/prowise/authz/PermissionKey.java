package com.prowise.authz;

import java.util.Arrays;

public enum PermissionKey {
    ORG_MANAGE("org.manage"),
    MEMBER_INVITE("member.invite"),
    MEMBER_DISABLE("member.disable"),
    ROLE_MANAGE("role.manage"),
    TEAM_MANAGE("team.manage"),
    PROJECT_CREATE("project.create"),
    PROJECT_READ("project.read"),
    PROJECT_EDIT("project.edit"),
    PROJECT_ARCHIVE("project.archive"),
    PROJECT_MODE_CHANGE("project.mode.change"),
    PROJECT_SCOPE_CHANGE("project.scope.change"),
    PROJECT_DEADLINE_EDIT("project.deadline.edit"),
    PROJECT_PROGRESS_REPORT("project.progress.report"),
    PROJECT_PROGRESS_OVERRIDE("project.progress.override"),
    PROJECT_PROGRESS_VERIFY("project.progress.verify"),
    TASK_CREATE("task.create"),
    TASK_ASSIGN("task.assign"),
    TASK_UPDATE("task.update"),
    TASK_REVIEW("task.review"),
    REPO_CONNECT("repo.connect"),
    REPO_READ("repo.read"),
    REPORT_EXPORT("report.export"),
    AUDIT_READ("audit.read");

    private final String value;

    PermissionKey(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static boolean isValid(String value) {
        return Arrays.stream(values()).anyMatch(key -> key.value.equals(value));
    }
}
