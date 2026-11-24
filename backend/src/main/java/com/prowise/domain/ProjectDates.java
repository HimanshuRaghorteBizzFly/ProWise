package com.prowise.domain;

import java.time.LocalDate;
import java.util.Optional;

/**
 * Dates of a new project, as calendar days in the project's time zone. A new project cannot start in the past, and
 * its target date is on or after the start date (or on or after today when no start date is given).
 */
public final class ProjectDates {

    private ProjectDates() {}

    public record Problem(String field, String message) {}

    public static Optional<Problem> forNewProject(LocalDate start, LocalDate target, LocalDate today) {
        if (start != null && start.isBefore(today)) {
            return Optional.of(new Problem("start_on", "must be today or later"));
        }
        LocalDate earliestTarget = start == null ? today : start;
        if (target != null && target.isBefore(earliestTarget)) {
            return Optional.of(new Problem("target_on", start == null ? "must be today or later" : "must be on or after the start date"));
        }
        return Optional.empty();
    }
}
