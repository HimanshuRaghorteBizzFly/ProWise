package com.prowise.common.config;

import java.util.List;

/** Names (never values) of required environment variables that are missing or blank. */
public class MissingEnvironmentException extends IllegalStateException {

    private final List<String> variables;

    public MissingEnvironmentException(List<String> variables) {
        super("Missing required environment variables: " + String.join(", ", variables));
        this.variables = List.copyOf(variables);
    }

    public List<String> variables() {
        return variables;
    }
}
