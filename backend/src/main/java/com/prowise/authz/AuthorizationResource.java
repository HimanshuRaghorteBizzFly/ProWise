package com.prowise.authz;

import java.util.UUID;

public record AuthorizationResource(UUID organizationId, UUID projectId) {}
