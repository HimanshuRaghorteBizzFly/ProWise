package com.prowise.common.api;

import java.util.List;

import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.core.converter.AnnotatedType;
import io.swagger.v3.core.converter.ModelConverters;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.ArraySchema;
import io.swagger.v3.oas.models.media.BooleanSchema;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.IntegerSchema;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.parameters.HeaderParameter;
import io.swagger.v3.oas.models.responses.ApiResponse;

/**
 * Typed contract skeleton published at /v3/api-docs: the error shape on every operation,
 * the cursor page envelope, and the Idempotency-Key / expectedVersion names.
 */
@Configuration
public class OpenApiConfiguration {

    private static final String ERROR_REF = "#/components/schemas/ErrorResponse";

    @Bean
    OpenAPI prowiseOpenApi() {
        return new OpenAPI().info(new Info()
                .title("Prowise API")
                .version("v1")
                .description("Tenant-scoped delivery management API. Errors always use ErrorResponse."));
    }

    @Bean
    OpenApiCustomizer contractSkeletonCustomizer() {
        return openApi -> {
            Components components = openApi.getComponents() == null ? new Components() : openApi.getComponents();
            openApi.setComponents(components);

            ModelConverters.getInstance().readAll(new AnnotatedType(ApiError.class)).forEach(components::addSchemas);

            components.addSchemas("CursorPage", new ObjectSchema()
                    .description("Cursor pagination envelope; list endpoints narrow `items`.")
                    .addProperty("items", new ArraySchema().items(new Schema<>()))
                    .addProperty("next_cursor", new StringSchema().nullable(true))
                    .addProperty("has_more", new BooleanSchema())
                    .required(List.of("items", "next_cursor", "has_more")));

            components.addSchemas("VersionedMutation", new ObjectSchema()
                    .description("Mutation bodies carry the entity version they were based on. "
                            + "A mismatch returns 409 STALE_VERSION.")
                    .addProperty(ApiHeaders.EXPECTED_VERSION, new IntegerSchema().format("int64").minimum(
                            java.math.BigDecimal.ZERO))
                    .required(List.of(ApiHeaders.EXPECTED_VERSION)));

            components.addParameters("IdempotencyKey", new HeaderParameter()
                    .name(ApiHeaders.IDEMPOTENCY_KEY)
                    .required(false)
                    .description("Retriable mutations: same key + same body returns the earlier result; "
                            + "same key + different body returns 409.")
                    .schema(new StringSchema().maxLength(255)));

            components.addParameters("RequestId", new HeaderParameter()
                    .name(ApiHeaders.REQUEST_ID)
                    .required(false)
                    .description("Optional correlation ID, echoed back when it is safe.")
                    .schema(new StringSchema().maxLength(100).pattern("^[A-Za-z0-9._:-]{1,100}$")));

            ApiResponse errorResponse = new ApiResponse()
                    .description("Error in the standard shape")
                    .content(new Content().addMediaType("application/json",
                            new MediaType().schema(new Schema<>().$ref(ERROR_REF))));
            if (openApi.getPaths() != null) {
                openApi.getPaths().values().forEach(path -> path.readOperations().forEach(operation -> {
                    if (operation.getResponses() != null && !operation.getResponses().containsKey("default")) {
                        operation.getResponses().addApiResponse("default", errorResponse);
                    }
                }));
            }
        };
    }
}
