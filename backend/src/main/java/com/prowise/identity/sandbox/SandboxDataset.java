package com.prowise.identity.sandbox;

import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/** Fake organisations and users for local/dev/test environments only. */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record SandboxDataset(List<Organization> organizations) {

    public SandboxDataset {
        organizations = List.copyOf(organizations);
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Organization(UUID id, String slug, String name, String timezone, List<User> users) {

        public Organization {
            users = List.copyOf(users);
        }
    }

    /** {@code roleTemplate} is only a starting template; it grants nothing by itself. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record User(UUID id, String email, String displayName, String roleTemplate) {
    }
}
