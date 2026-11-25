package com.prowise.superadmin.keys;

import java.util.List;

public final class PlatformKeysDTOs {
    private PlatformKeysDTOs() {}

    /**
     * One server setting. {@code value} is always null for a secret; only whether it is configured is reported.
     */
    public record KeyItem(
        String key,
        String category,
        String purpose,
        boolean secret,
        boolean required,
        boolean configured,
        String value
    ) {}

    public record PlatformKeysResponse(List<KeyItem> keys) {}
}
