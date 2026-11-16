package com.prowise.common.api;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Lets the web app (NEXT_PUBLIC_API_BASE_URL callers) reach /v1 from the configured origins only. */
@Configuration
public class WebCorsConfiguration implements WebMvcConfigurer {

    private final String[] allowedOrigins;

    public WebCorsConfiguration(@Value("${prowise.cors.allowed-origins}") String[] allowedOrigins) {
        this.allowedOrigins = allowedOrigins;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/v1/**")
                .allowedOrigins(allowedOrigins)
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("Accept", "Authorization", "Content-Type",
                        ApiHeaders.IDEMPOTENCY_KEY, ApiHeaders.REQUEST_ID)
                .exposedHeaders(ApiHeaders.REQUEST_ID)
                .allowCredentials(true)
                .maxAge(3600);
    }
}
