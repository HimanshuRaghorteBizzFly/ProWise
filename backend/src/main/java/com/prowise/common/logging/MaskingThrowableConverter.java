package com.prowise.common.logging;

import ch.qos.logback.classic.pattern.ExtendedThrowableProxyConverter;
import ch.qos.logback.classic.spi.ILoggingEvent;

/** Logback {@code %maskEx}: stack traces with credentials in exception messages masked. */
public class MaskingThrowableConverter extends ExtendedThrowableProxyConverter {

    @Override
    public String convert(ILoggingEvent event) {
        return SensitiveDataMasker.mask(super.convert(event));
    }
}
