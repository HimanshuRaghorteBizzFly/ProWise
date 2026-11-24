package com.prowise.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Set;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import com.prowise.calendar.WorkingCalendar;
import com.prowise.domain.CheckInSchedule.Display;
import com.prowise.domain.CheckInSchedule.Frequency;

@Tag("FR-037")
@Tag("NFR-12")
class CheckInScheduleTest {

    private static final ZoneId LONDON = ZoneId.of("Europe/London");
    private static final WorkingCalendar MONDAY_HOLIDAY = new WorkingCalendar(WorkingCalendar.DEFAULT_WORKDAYS,
            Set.of(LocalDate.of(2026, 6, 8)), LONDON);

    @Test
    void fridayPlusOneWorkingDayWithMondayHolidayIsTuesday() {
        LocalDate friday = LocalDate.of(2026, 6, 5);
        assertThat(CheckInSchedule.graceUntil(friday, 1, MONDAY_HOLIDAY)).isEqualTo(LocalDate.of(2026, 6, 9));
        assertThat(CheckInSchedule.nextDue(Frequency.WEEKLY, DayOfWeek.FRIDAY, LocalDate.of(2026, 6, 3), null, MONDAY_HOLIDAY)).isEqualTo(friday);
    }

    @Test
    void dueDayOnAHolidayMovesToTheNextWorkingDay() {
        assertThat(CheckInSchedule.nextDue(Frequency.WEEKLY, DayOfWeek.MONDAY, LocalDate.of(2026, 6, 6), null, MONDAY_HOLIDAY))
                .isEqualTo(LocalDate.of(2026, 6, 9));
        assertThat(CheckInSchedule.nextDue(Frequency.DAILY, DayOfWeek.FRIDAY, LocalDate.of(2026, 6, 6), null, MONDAY_HOLIDAY))
                .isEqualTo(LocalDate.of(2026, 6, 9));
    }

    @Test
    void fortnightlyCountsWeeksFromTheAnchor() {
        LocalDate anchor = LocalDate.of(2026, 6, 1);
        assertThat(CheckInSchedule.nextDue(Frequency.FORTNIGHTLY, DayOfWeek.FRIDAY, anchor, anchor, MONDAY_HOLIDAY)).isEqualTo(LocalDate.of(2026, 6, 5));
        assertThat(CheckInSchedule.nextDue(Frequency.FORTNIGHTLY, DayOfWeek.FRIDAY, LocalDate.of(2026, 6, 6), anchor, MONDAY_HOLIDAY))
                .isEqualTo(LocalDate.of(2026, 6, 19));
    }

    @Test
    void cutoffFollowsDaylightSavingTime() {
        WorkingCalendar calendar = new WorkingCalendar(WorkingCalendar.DEFAULT_WORKDAYS, Set.of(), LONDON);
        Instant winter = CheckInSchedule.cutoff(LocalDate.of(2026, 3, 27), LocalTime.of(17, 0), calendar);
        Instant summer = CheckInSchedule.cutoff(LocalDate.of(2026, 3, 30), LocalTime.of(17, 0), calendar); // after the clocks go forward
        assertThat(winter).isEqualTo(Instant.parse("2026-03-27T17:00:00Z"));
        assertThat(summer).isEqualTo(Instant.parse("2026-03-30T16:00:00Z"));
        // The day the clocks change has 23 hours: the next local date starts at midnight local time, not 24h later.
        Instant overdue = CheckInSchedule.overdueFrom(LocalDate.of(2026, 3, 29), calendar);
        assertThat(ZonedDateTime.ofInstant(overdue, LONDON).toLocalTime()).isEqualTo(LocalTime.MIDNIGHT);
        assertThat(overdue).isEqualTo(Instant.parse("2026-03-29T23:00:00Z"));
    }

    @Test
    void checkInDisplayStates() {
        LocalDate due = LocalDate.of(2026, 6, 5);
        Instant cutoff = Instant.parse("2026-06-05T16:00:00Z");
        Instant grace = Instant.parse("2026-06-09T16:00:00Z");
        assertThat(CheckInSchedule.checkIn(Instant.parse("2026-06-03T10:00:00Z"), LocalDate.of(2026, 6, 3), due, cutoff, grace, false)).isEqualTo(Display.UPCOMING);
        assertThat(CheckInSchedule.checkIn(Instant.parse("2026-06-05T10:00:00Z"), due, due, cutoff, grace, false)).isEqualTo(Display.DUE_TODAY);
        assertThat(CheckInSchedule.checkIn(Instant.parse("2026-06-08T10:00:00Z"), LocalDate.of(2026, 6, 8), due, cutoff, grace, false)).isEqualTo(Display.IN_GRACE);
        assertThat(CheckInSchedule.checkIn(Instant.parse("2026-06-10T10:00:00Z"), LocalDate.of(2026, 6, 10), due, cutoff, grace, false)).isEqualTo(Display.MISSED);
        assertThat(CheckInSchedule.checkIn(Instant.parse("2026-06-10T10:00:00Z"), LocalDate.of(2026, 6, 10), due, cutoff, grace, true)).isEqualTo(Display.PAUSED);
    }

    @Test
    void complianceHasNoRateWithoutEligibleWindows() {
        assertThat(CheckInSchedule.compliance(0, 0, 1, 0, 2).rate()).isNull();
        assertThat(CheckInSchedule.compliance(3, 1, 1, 1, 0).rate()).isEqualByComparingTo("75");
        assertThat(CheckInSchedule.compliance(3, 1, 1, 1, 0).eligible()).isEqualTo(4);
    }
}
