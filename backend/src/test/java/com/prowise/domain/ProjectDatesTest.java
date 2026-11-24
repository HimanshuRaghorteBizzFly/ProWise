package com.prowise.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("T09")
class ProjectDatesTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 24);

    @Test
    void startTodayOrLaterIsAllowed() {
        assertThat(ProjectDates.forNewProject(TODAY, TODAY, TODAY)).isEmpty();
        assertThat(ProjectDates.forNewProject(TODAY.plusDays(3), TODAY.plusDays(30), TODAY)).isEmpty();
        assertThat(ProjectDates.forNewProject(null, null, TODAY)).isEmpty();
    }

    @Test
    void pastStartIsRefused() {
        assertThat(ProjectDates.forNewProject(TODAY.minusDays(1), null, TODAY)).get()
                .extracting(ProjectDates.Problem::field).isEqualTo("start_on");
    }

    @Test
    void targetBeforeStartIsRefused() {
        assertThat(ProjectDates.forNewProject(TODAY.plusDays(5), TODAY.plusDays(4), TODAY)).get()
                .extracting(ProjectDates.Problem::field).isEqualTo("target_on");
    }

    @Test
    void pastTargetWithoutStartIsRefused() {
        assertThat(ProjectDates.forNewProject(null, TODAY.minusDays(1), TODAY)).get()
                .extracting(ProjectDates.Problem::field).isEqualTo("target_on");
        assertThat(ProjectDates.forNewProject(null, TODAY, TODAY)).isEmpty();
    }
}
