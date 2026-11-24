package com.prowise.operator.console;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;

import com.prowise.common.api.ApiError;
import com.prowise.common.api.ApiException;
import com.prowise.common.api.ErrorCodes;

/** Small helpers for the console's read queries: optional filters, pagination and column reads. */
final class ConsoleSql {

    static final int DEFAULT_SIZE = 25;
    static final int MAX_SIZE = 100;

    private ConsoleSql() {}

    record Paging(int page, int size) {
        long offset() {
            return (long) page * size;
        }
    }

    static Paging paging(Integer page, Integer size) {
        int p = page == null ? 0 : page;
        int s = size == null ? DEFAULT_SIZE : size;
        List<ApiError.FieldError> errors = new ArrayList<>();
        if (p < 0) errors.add(new ApiError.FieldError("page", "must be 0 or greater"));
        if (s < 1 || s > MAX_SIZE) errors.add(new ApiError.FieldError("size", "must be between 1 and " + MAX_SIZE));
        if (!errors.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED, "The request has invalid fields.", errors);
        }
        return new Paging(p, s);
    }

    static void checkRange(Instant from, Instant to) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED, "The request has invalid fields.",
                    List.of(new ApiError.FieldError("from", "must not be after to")));
        }
    }

    /** Collects AND-ed conditions with their named parameters. */
    static final class Where {
        private final List<String> conditions = new ArrayList<>();
        final MapSqlParameterSource params = new MapSqlParameterSource();

        Where add(String condition) {
            conditions.add(condition);
            return this;
        }

        Where add(String condition, String name, Object value) {
            conditions.add(condition);
            params.addValue(name, value);
            return this;
        }

        String sql() {
            return conditions.isEmpty() ? "" : " WHERE " + String.join(" AND ", conditions);
        }
    }

    static boolean present(String value) {
        return value != null && !value.isBlank() && !"ALL".equalsIgnoreCase(value.trim());
    }

    static String upper(String value) {
        return value.trim().toUpperCase(Locale.ROOT);
    }

    /** %term% for ILIKE with the LIKE wildcards in the term escaped (default escape character is backslash). */
    static String like(String term) {
        String escaped = term.trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return "%" + escaped + "%";
    }

    static Instant instant(ResultSet rs, String column) throws SQLException {
        OffsetDateTime value = rs.getObject(column, OffsetDateTime.class);
        return value == null ? null : value.toInstant();
    }

    static LocalDate date(ResultSet rs, String column) throws SQLException {
        return rs.getObject(column, LocalDate.class);
    }

    static String text(ResultSet rs, String column) throws SQLException {
        Object value = rs.getObject(column);
        return value == null ? null : value.toString();
    }
}
