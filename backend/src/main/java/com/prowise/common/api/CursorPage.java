package com.prowise.common.api;

import java.util.List;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/**
 * Cursor pagination envelope for every list endpoint. Ordering must be deterministic with a unique
 * ID tiebreaker, and the cursor never bypasses tenant or permission filters.
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record CursorPage<T>(List<T> items, String nextCursor, boolean hasMore) {

    public CursorPage {
        items = items == null ? List.of() : List.copyOf(items);
        if (hasMore && (nextCursor == null || nextCursor.isBlank())) {
            throw new IllegalArgumentException("hasMore requires a next cursor");
        }
    }

    public static <T> CursorPage<T> last(List<T> items) {
        return new CursorPage<>(items, null, false);
    }

    public static <T> CursorPage<T> of(List<T> items, String nextCursor) {
        return new CursorPage<>(items, nextCursor, nextCursor != null && !nextCursor.isBlank());
    }
}
