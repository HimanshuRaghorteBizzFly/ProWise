package com.prowise.operator;

public enum OperatorAccessLevel {
    MAIN_PLATFORM_OPERATOR,
    DEPARTMENT_OPERATOR;

    public static OperatorAccessLevel fromString(String value) {
        if (value == null || value.isBlank()) {
            return DEPARTMENT_OPERATOR;
        }
        for (OperatorAccessLevel level : values()) {
            if (level.name().equalsIgnoreCase(value.trim()) ||
                level.name().replace("_", "").equalsIgnoreCase(value.replace("_", "").replace(" ", "").trim())) {
                return level;
            }
        }
        return DEPARTMENT_OPERATOR;
    }
}
