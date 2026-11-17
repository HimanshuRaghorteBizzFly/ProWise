package com.prowise.common.config;

import org.springframework.boot.diagnostics.AbstractFailureAnalyzer;
import org.springframework.boot.diagnostics.FailureAnalysis;

/** Turns a missing-configuration failure into a short, actionable startup message. */
public class MissingEnvironmentFailureAnalyzer extends AbstractFailureAnalyzer<MissingEnvironmentException> {

    @Override
    protected FailureAnalysis analyze(Throwable rootFailure, MissingEnvironmentException cause) {
        return new FailureAnalysis(
                "Prowise cannot start: these required environment variables are missing or blank: "
                        + String.join(", ", cause.variables()) + ".",
                "Local: copy backend/.env.example to backend/.env and fill in the values. "
                        + "CI/production: set them in the environment or secret manager. Values are never logged.",
                cause);
    }

    /** Visible for tests. */
    public FailureAnalysis analyze(MissingEnvironmentException cause) {
        return analyze(cause, cause);
    }
}
